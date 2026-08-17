# Candy Browser Toppings

Community-maintained Toppings for [Candy Browser](https://github.com/sk2andy/candy-browser).
Toppings are small, auditable userscripts that adjust matching websites. Candy fetches this
catalog from `main` when the user opens **Settings → Toppings entdecken**. Publishing a Topping
therefore needs no Candy Browser release.

## Available Toppings

| Topping | Purpose | Sites |
| --- | --- | --- |
| GitHub Readable Diffs | Makes pull-request diffs denser and easier to scan | `github.com` |
| Hacker News Comfort | Adds readable cards, larger type, and stronger tap targets | `news.ycombinator.com` |
| YouTube No Shorts | Opens Shorts in the regular video player | `www.youtube.com` |

## Repository contract

- `catalog.json` is the only catalog index. Its schema version is `1`.
- Every entry points to `toppings/<id>.user.js` and contains the file's lowercase SHA-256.
- `matches` repeats the script's positive `@match` values followed by its `@include` values.
- Candy downloads source only after explicit user action, verifies SHA-256, then applies the
  same bounded parser used for local imports.
- Updated Toppings need a new `version` and SHA-256. Candy can then show the available update.
- Catalog availability is optional. Existing installed Toppings keep working when GitHub or the
  network is unavailable.

Run all repository checks with Node.js 20 or newer:

```sh
npm test
npm run validate
```

No package installation is required; validator uses only Node.js standard-library modules.

## Security boundary

A Topping runs inside matching pages and can access what those pages expose to JavaScript,
including signed-in page state. Read source before enabling it. Candy does not provide privileged
`GM_*` APIs, cross-origin access, remote dependencies, or execution in private tabs.

SHA-256 detects an inconsistent or corrupted download. It does not protect against a compromised
catalog repository. Every contribution therefore requires review before merge.

Want to add or update one? Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
The pull request template captures required scope, testing, accessibility, and security details.
