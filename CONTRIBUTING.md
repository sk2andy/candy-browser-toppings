# Contributing a Topping

Submit one Topping per pull request. Keep it small enough to review without generated or minified
code.

## Required files

1. Add `toppings/<id>.user.js`. Use a lowercase, hyphen-separated stable ID.
2. Add one matching entry to `catalog.json`.
3. Compute the raw file SHA-256 (`shasum -a 256 toppings/<id>.user.js`).
4. Run `npm run check`.
5. Explain purpose, tested URLs, and screenshots or behavior before/after in the pull request.

Catalog entries use this exact shape:

```json
{
  "id": "example-topping",
  "name": "Example Topping",
  "description": "One short sentence shown before installation.",
  "author": "Your name or GitHub handle",
  "license": "MIT",
  "version": "1.0.0",
  "source": "toppings/example-topping.user.js",
  "matches": [
    "https://example.com/*"
  ],
  "sha256": "64 lowercase hexadecimal characters"
}
```

`matches` must exactly equal all declared `@match` values followed by all declared `@include`
values, preserving their order. Entries in `catalog.json` must be sorted by `id`.

## Supported userscript subset

| Metadata | Rule |
| --- | --- |
| `@name` | Required once; must equal catalog name |
| `@description` | Required once; must equal catalog description |
| `@version` | Required once; must equal catalog version |
| `@license` | Required once; must equal catalog SPDX license |
| `@match`, `@include` | At least one bounded HTTP(S) pattern |
| `@exclude` | Optional; exclusion wins |
| `@run-at` | `document-start` or `document-end` |
| `@grant` | Only `none` |

Candy rejects `@require`, `@resource`, `@downloadURL`, `@updateURL`, `@connect`, privileged
grants, sources over 256 KiB, and catalogs over 128 entries. Match patterns do not support
explicit ports; use a bounded `@include` when a non-default port is needed.
The curated catalog accepts exact hosts only. List each intended host explicitly; wildcard hosts
are rejected even though locally authored Toppings may use them.

## Review rules

- No obfuscated, minified, generated, vendored, or remotely loaded code.
- No analytics, tracking, advertising, credential access, or data exfiltration.
- Avoid network requests. If essential, document every destination and reason in the pull request.
- Scope matches to the narrowest hosts and paths that work.
- Use no page storage unless the feature needs it and the behavior is clearly documented.
- Make DOM changes idempotent and fail safely when a site's markup changes.
- Keep unrelated site functionality and accessibility intact.
- Authors must have rights to publish the code under the entry's SPDX license.

Website markup changes. Maintainers may update, disable, or remove a broken or unsafe Topping.
