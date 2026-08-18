# Candy Browser Toppings

Community-maintained Toppings for [Candy Browser](https://github.com/sk2andy/candy-browser).
Toppings are small, auditable userscripts that adjust matching websites. Candy fetches this
catalog from `main` when the user opens **Settings → Toppings entdecken**. Publishing a Topping
therefore needs no Candy Browser release.

## Available Toppings

| Topping | Purpose | Sites |
| --- | --- | --- |
| Copy Code Button | Adds accessible copy buttons where documentation sites lack them | `developer.android.com`, `developer.mozilla.org`, `docs.github.com`, `docs.gradle.org` |
| GitHub Readable Diffs | Makes pull-request diffs denser and easier to scan | `github.com` |
| Google Search Cleanup | Cleans redirects and tracking parameters from search-result links | `google.com`, `google.de` |
| Hacker News Comfort | Adds readable cards, larger type, and stronger tap targets | `news.ycombinator.com` |
| Link Tracking Cleaner | Removes known tracking parameters from outbound links | GitHub, Medium, Hacker News, Reddit |
| Medium Reading Focus | Removes sticky app and sign-up chrome without touching paywalls | `medium.com` |
| Reddit Thread Comfort | Removes app prompts and improves mobile comment readability | `reddit.com` |
| Spoilerfree Sports | Hides scores and winner cues behind a full-width, on-by-default toggle | FIFA, Flashscore, Sky Sports, Cricbuzz, ESPNcricinfo, Goal, LiveScore, Yahoo Sports, ESPN US/UK, NBA, NFL, NHL, MLB, Kicker, Google Search, Sport Bild, SofaScore |
| YouTube No Shorts | Opens Shorts in the regular video player | `www.youtube.com` |

Spoilerfree Sports stores no preference of its own. On NBA pages it drives NBA's native Hide
Scores switch, then immediately restores the site's existing `hideScores` preference so enabling
or removing the Topping does not change the user's choice for later visits.

On ESPN, Yahoo Sports, NBA, NFL, NHL, MLB, Kicker, Cricbuzz, ESPNcricinfo, and Goal the script can
load across the exact site host so it also catches score modules embedded on home, article,
team-schedule, competition, and localized routes. Flashscore team-result pages, Sky Sports
football and cricket hubs, and LiveScore match timelines are also covered. The toggle is only
inserted after a known score component is detected.

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
