import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateCatalog } from "../scripts/validate-catalog.mjs";

const VALID_SOURCE = `// ==UserScript==
// @name Example Topping
// @description A small example used by validator tests.
// @version 1.0.0
// @license MIT
// @match https://example.com/*
// @include https://example.org/articles/*
// @exclude https://example.com/private/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";
})();
`;

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function entryFor(source, overrides = {}) {
  return {
    id: "example-topping",
    name: "Example Topping",
    description: "A small example used by validator tests.",
    author: "Candy Browser contributors",
    license: "MIT",
    version: "1.0.0",
    source: "toppings/example-topping.user.js",
    matches: ["https://example.com/*", "https://example.org/articles/*"],
    sha256: sha256(source),
    ...overrides,
  };
}

async function createFixture(t, { source = VALID_SOURCE, entry = entryFor(source), extraFiles = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "candy-toppings-validator-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "toppings"));
  await writeFile(path.join(root, "toppings/example-topping.user.js"), source);
  for (const [name, content] of Object.entries(extraFiles)) {
    await writeFile(path.join(root, "toppings", name), content);
  }
  await writeFile(
    path.join(root, "catalog.json"),
    `${JSON.stringify({ schemaVersion: 1, toppings: [entry] }, null, 2)}\n`,
  );
  return root;
}

test("accepts catalog matching Candy userscript subset", async (t) => {
  const root = await createFixture(t);

  assert.deepEqual(await validateCatalog(root), { toppingCount: 1 });
});

test("rejects source whose SHA-256 differs from catalog", async (t) => {
  const root = await createFixture(t, {
    entry: entryFor(VALID_SOURCE, { sha256: "0".repeat(64) }),
  });

  await assert.rejects(validateCatalog(root), /SHA-256 mismatch/);
});

test("rejects catalog scope differing from source metadata", async (t) => {
  const root = await createFixture(t, {
    entry: entryFor(VALID_SOURCE, { matches: ["https:\/\/example.com\/*"] }),
  });

  await assert.rejects(validateCatalog(root), /catalog matches must equal/);
});

test("rejects remote dependency metadata", async (t) => {
  const source = VALID_SOURCE.replace("// @run-at", "// @require https://example.com/code.js\n// @run-at");
  const root = await createFixture(t, { source, entry: entryFor(source) });

  await assert.rejects(validateCatalog(root), /@require is not supported/);
});

test("rejects a UTF-8 BOM so installed hashes remain comparable", async (t) => {
  const source = `\uFEFF${VALID_SOURCE}`;
  const root = await createFixture(t, { source, entry: entryFor(source) });

  await assert.rejects(validateCatalog(root), /UTF-8 BOM is not supported/);
});

test("rejects catalog Toppings with an all-sites scope", async (t) => {
  const source = VALID_SOURCE
    .replace("https://example.com/*", "*://*/*")
    .replace("// @include https://example.org/articles/*\n", "");
  const root = await createFixture(t, {
    source,
    entry: entryFor(source, { matches: ["*://*/*"] }),
  });

  await assert.rejects(validateCatalog(root), /invalid @match pattern/);
});

test("rejects unlisted userscript files", async (t) => {
  const root = await createFixture(t, {
    extraFiles: { "unlisted.user.js": VALID_SOURCE },
  });

  await assert.rejects(validateCatalog(root), /exactly one catalog entry/);
});

test("rejects non-canonical catalog formatting", async (t) => {
  const root = await createFixture(t);
  await writeFile(
    path.join(root, "catalog.json"),
    JSON.stringify({ schemaVersion: 1, toppings: [entryFor(VALID_SOURCE)] }),
  );

  await assert.rejects(validateCatalog(root), /canonical two-space formatting/);
});
