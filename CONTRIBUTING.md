# Contributing a Topping

Submit one Topping per pull request. Keep it small enough to review without generated or minified
code.

By submitting a change, you agree that maintainers may review the complete source, request a
narrower scope, decline behavior that creates avoidable risk, and remove a Topping later if it
becomes unsafe or stops working.

## Before opening a pull request

- Search existing Toppings and pull requests to avoid duplicates.
- Test against current versions of every explicitly listed host.
- Keep the implementation focused on one user-visible purpose.
- Read the full source as it will be published; do not submit code you cannot explain.
- Confirm that you have the right to publish the code under the declared SPDX license.

## Required files

1. Add `toppings/<id>.user.js`. Use a lowercase, hyphen-separated stable ID.
2. Add one matching entry to `catalog.json`.
3. Compute the raw file SHA-256 (`shasum -a 256 toppings/<id>.user.js`).
4. Run `npm run check`.
5. Explain purpose, tested URLs, and screenshots or behavior before/after in the pull request.

For changes to an existing Topping, keep its `id` and source path stable, increment its semantic
version, update its SHA-256, and describe any changed behavior or scope. Do not reuse a version for
different source.

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

## Pull request requirements

A pull request is ready for merge only when:

- repository validation and tests pass;
- the pull request template is complete;
- every host, path, storage use, and network request is disclosed;
- visual changes include screenshots or a clear before/after description;
- at least one maintainer approves the exact source and catalog diff; and
- no unresolved review thread remains.

Contributions merge through pull requests only. Maintainers may ask for simpler code, narrower
matching paths, additional tests, accessibility fixes, or removal of a capability before approval.
Approval is discretionary because enabled Toppings execute with the page's signed-in session.

## Reporting security problems

Do not open a public pull request that demonstrates credential theft, data exfiltration, or another
active vulnerability in a published Topping. Report it privately through the Candy Browser
Toppings repository's GitHub security advisory flow and include the affected Topping ID and version.

Website markup changes. Maintainers may update, disable, or remove a broken or unsafe Topping.
