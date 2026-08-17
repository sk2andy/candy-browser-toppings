import { createHash } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const CATALOG_KEYS = ["schemaVersion", "toppings"];
const ENTRY_KEYS = [
  "id",
  "name",
  "description",
  "author",
  "license",
  "version",
  "source",
  "matches",
  "sha256",
];
const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_SOURCE_BYTES = 256 * 1024;
const MAX_TOPPINGS = 128;
const MAX_NAME_CHARS = 120;
const MAX_PATTERN_CHARS = 2048;
const MAX_PATTERNS_PER_KIND = 64;
const REMOTE_DIRECTIVES = new Set(["require", "resource", "downloadurl", "updateurl"]);
const METADATA_START = /^\s*\/\/\s*==UserScript==\s*$/;
const METADATA_END = /^\s*\/\/\s*==\/UserScript==\s*$/;
const METADATA_LINE = /^\s*\/\/\s*@([A-Za-z][A-Za-z0-9_-]*)\s*(.*?)\s*$/;
const MATCH_PATTERN = /^(http|https|\*):\/\/([^/]+)(\/.*)$/i;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function requirePlainObject(value, label) {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value);
  requireCondition(
    actual.length === expected.length && actual.every((key, index) => key === expected[index]),
    `${label} keys must be exactly: ${expected.join(", ")}`,
  );
}

function requireBoundedString(value, label, maxChars) {
  requireCondition(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
  requireCondition(value.length <= maxChars, `${label} exceeds ${maxChars} characters`);
  requireCondition(!Array.from(value).some((char) => char.codePointAt(0) < 0x20 || char.codePointAt(0) === 0x7f), `${label} contains control characters`);
}

function parseMetadata(source, label) {
  requireCondition(!source.startsWith("\uFEFF"), `${label}: UTF-8 BOM is not supported`);
  const normalized = source.replace(/^\uFEFF/, "");
  const lines = normalized.split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
  const start = lines.findIndex((line) => METADATA_START.test(line));
  requireCondition(start >= 0, `${label}: missing userscript metadata block`);
  const relativeEnd = lines.slice(start + 1).findIndex((line) => METADATA_END.test(line));
  requireCondition(relativeEnd >= 0, `${label}: unterminated userscript metadata block`);
  const end = start + 1 + relativeEnd;
  requireCondition(!lines.slice(end + 1).some((line) => METADATA_START.test(line)), `${label}: multiple userscript metadata blocks`);

  const values = new Map();
  for (const line of lines.slice(start + 1, end)) {
    const match = line.match(METADATA_LINE);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const list = values.get(key) ?? [];
    list.push(match[2].trim());
    values.set(key, list);
  }
  return { normalized, values };
}

function metadataValues(values, key) {
  return values.get(key) ?? [];
}

function isBoundedPattern(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_PATTERN_CHARS
    && !Array.from(value).some((char) => char.codePointAt(0) < 0x20 || char.codePointAt(0) === 0x7f);
}

function validHostname(host) {
  if (!host || host.includes("*")) return false;
  if (host.startsWith("[") && host.endsWith("]")) {
    try {
      return Boolean(new URL(`https://${host}/`).hostname);
    } catch {
      return false;
    }
  }
  if (host.includes(":")) return false;
  try {
    const url = new URL(`https://${host}/`);
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validMatchPattern(value) {
  if (value === "<all_urls>") return false;
  if (!isBoundedPattern(value)) return false;
  const match = value.match(MATCH_PATTERN);
  if (!match) return false;
  const host = match[2].toLowerCase();
  if (host === "*") return false;
  return validHostname(host);
}

function validGlobPattern(value) {
  if (!isBoundedPattern(value)) return false;
  const match = value.match(MATCH_PATTERN);
  if (!match) return false;
  const authority = match[2].toLowerCase();
  if (!authority || authority.includes("@")) return false;
  const portSeparator = authority.lastIndexOf(":");
  const host = portSeparator >= 0 ? authority.slice(0, portSeparator) : authority;
  const port = portSeparator >= 0 ? authority.slice(portSeparator + 1) : null;
  if (port !== null && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) return false;
  if (host === "*") return false;
  return validHostname(host);
}

function validateUserscript(source, entry) {
  const label = entry.source;
  const { normalized, values } = parseMetadata(source, label);
  for (const directive of REMOTE_DIRECTIVES) {
    requireCondition(!values.has(directive), `${label}: @${directive} is not supported`);
  }
  requireCondition(!values.has("connect"), `${label}: @connect is not supported`);
  requireCondition(
    metadataValues(values, "grant").every((grant) => grant.toLowerCase() === "none"),
    `${label}: only @grant none is supported`,
  );

  const names = metadataValues(values, "name");
  requireCondition(names.length === 1 && names[0].trim(), `${label}: exactly one non-empty @name is required`);
  requireCondition(names[0] === entry.name, `${label}: @name must equal catalog name`);
  requireCondition(names[0].length <= MAX_NAME_CHARS, `${label}: @name exceeds ${MAX_NAME_CHARS} characters`);
  const descriptions = metadataValues(values, "description");
  requireCondition(descriptions.length === 1 && descriptions[0] === entry.description, `${label}: @description must equal catalog description`);
  const versions = metadataValues(values, "version");
  requireCondition(versions.length === 1 && versions[0] === entry.version, `${label}: @version must equal catalog version`);
  const licenses = metadataValues(values, "license");
  requireCondition(licenses.length === 1 && licenses[0] === entry.license, `${label}: @license must equal catalog license`);

  const matches = metadataValues(values, "match");
  const includes = metadataValues(values, "include");
  const excludes = metadataValues(values, "exclude");
  requireCondition(matches.length + includes.length > 0, `${label}: @match or @include is required`);
  requireCondition(matches.length <= MAX_PATTERNS_PER_KIND, `${label}: too many @match values`);
  requireCondition(includes.length <= MAX_PATTERNS_PER_KIND, `${label}: too many @include values`);
  requireCondition(excludes.length <= MAX_PATTERNS_PER_KIND, `${label}: too many @exclude values`);
  requireCondition(matches.every(validMatchPattern), `${label}: invalid @match pattern`);
  requireCondition(includes.every(validGlobPattern), `${label}: invalid @include pattern`);
  requireCondition(excludes.every(validGlobPattern), `${label}: invalid @exclude pattern`);

  const declaredMatches = [...matches, ...includes];
  requireCondition(
    declaredMatches.length === entry.matches.length
      && declaredMatches.every((value, index) => value === entry.matches[index]),
    `${label}: catalog matches must equal @match values followed by @include values`,
  );

  const runAt = metadataValues(values, "run-at");
  requireCondition(runAt.length <= 1, `${label}: only one @run-at is allowed`);
  requireCondition(
    runAt.length === 0 || runAt[0].toLowerCase() === "document-start" || runAt[0].toLowerCase() === "document-end",
    `${label}: invalid @run-at`,
  );

  try {
    new vm.Script(normalized, { filename: label });
  } catch (error) {
    throw new Error(`${label}: invalid JavaScript: ${error.message}`);
  }
}

function validateEntry(entry, index) {
  const label = `toppings[${index}]`;
  requirePlainObject(entry, label);
  requireExactKeys(entry, ENTRY_KEYS, label);
  requireBoundedString(entry.id, `${label}.id`, 64);
  requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), `${label}.id must be a lowercase slug`);
  requireBoundedString(entry.name, `${label}.name`, MAX_NAME_CHARS);
  requireBoundedString(entry.description, `${label}.description`, 240);
  requireBoundedString(entry.author, `${label}.author`, 120);
  requireBoundedString(entry.license, `${label}.license`, 64);
  requireCondition(/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(entry.license), `${label}.license must be an SPDX identifier`);
  requireCondition(typeof entry.version === "string" && SEMVER.test(entry.version), `${label}.version must be SemVer`);
  requireCondition(entry.source === `toppings/${entry.id}.user.js`, `${label}.source must be toppings/<id>.user.js`);
  requireCondition(Array.isArray(entry.matches) && entry.matches.length > 0, `${label}.matches must be a non-empty array`);
  requireCondition(entry.matches.length <= MAX_PATTERNS_PER_KIND * 2, `${label}.matches has too many values`);
  entry.matches.forEach((value, matchIndex) => requireBoundedString(value, `${label}.matches[${matchIndex}]`, MAX_PATTERN_CHARS));
  requireCondition(typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256), `${label}.sha256 must be lowercase SHA-256`);
}

export async function validateCatalog(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const catalogPath = path.join(root, "catalog.json");
  const catalogBytes = await readFile(catalogPath);
  requireCondition(catalogBytes.length <= MAX_CATALOG_BYTES, `catalog.json exceeds ${MAX_CATALOG_BYTES} bytes`);

  let catalog;
  try {
    catalog = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(catalogBytes));
  } catch (error) {
    throw new Error(`catalog.json is not valid UTF-8 JSON: ${error.message}`);
  }
  requirePlainObject(catalog, "catalog");
  requireExactKeys(catalog, CATALOG_KEYS, "catalog");
  requireCondition(catalog.schemaVersion === 1, "catalog.schemaVersion must be 1");
  requireCondition(Array.isArray(catalog.toppings), "catalog.toppings must be an array");
  requireCondition(catalog.toppings.length <= MAX_TOPPINGS, `catalog has more than ${MAX_TOPPINGS} entries`);

  catalog.toppings.forEach(validateEntry);
  const ids = catalog.toppings.map((entry) => entry.id);
  requireCondition(new Set(ids).size === ids.length, "catalog IDs must be unique");
  requireCondition(ids.every((id, index) => index === 0 || ids[index - 1].localeCompare(id, "en") < 0), "catalog entries must be sorted by id");
  requireCondition(new Set(catalog.toppings.map((entry) => entry.source)).size === catalog.toppings.length, "catalog sources must be unique");

  const expectedText = `${JSON.stringify(catalog, null, 2)}\n`;
  requireCondition(catalogBytes.equals(Buffer.from(expectedText)), "catalog.json must use canonical two-space formatting and end with a newline");

  const toppingsDirectory = path.join(root, "toppings");
  const directoryEntries = await readdir(toppingsDirectory, { withFileTypes: true });
  requireCondition(directoryEntries.every((entry) => entry.isFile() && entry.name.endsWith(".user.js")), "toppings/ may contain only regular .user.js files");
  const actualSources = directoryEntries.map((entry) => `toppings/${entry.name}`).sort();
  const expectedSources = catalog.toppings.map((entry) => entry.source).sort();
  requireCondition(
    actualSources.length === expectedSources.length && actualSources.every((source, index) => source === expectedSources[index]),
    "every .user.js file must have exactly one catalog entry",
  );

  for (const entry of catalog.toppings) {
    const sourcePath = path.join(root, entry.source);
    const stat = await lstat(sourcePath);
    requireCondition(stat.isFile() && !stat.isSymbolicLink(), `${entry.source} must be a regular file`);
    const sourceBytes = await readFile(sourcePath);
    requireCondition(sourceBytes.length <= MAX_SOURCE_BYTES, `${entry.source} exceeds ${MAX_SOURCE_BYTES} bytes`);
    requireCondition(
      !(sourceBytes[0] === 0xef && sourceBytes[1] === 0xbb && sourceBytes[2] === 0xbf),
      `${entry.source}: UTF-8 BOM is not supported`,
    );
    const digest = createHash("sha256").update(sourceBytes).digest("hex");
    requireCondition(digest === entry.sha256, `${entry.source}: SHA-256 mismatch`);
    let source;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
    } catch (error) {
      throw new Error(`${entry.source}: invalid UTF-8: ${error.message}`);
    }
    validateUserscript(source, entry);
  }

  return { toppingCount: catalog.toppings.length };
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  try {
    const result = await validateCatalog(root);
    console.log(`Validated ${result.toppingCount} Toppings.`);
  } catch (error) {
    console.error(`Catalog validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
