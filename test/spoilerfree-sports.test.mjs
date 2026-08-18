import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const sourcePath = path.resolve("toppings/spoilerfree-sports.user.js");
const source = await readFile(sourcePath, "utf8");

class FakeStyle {
  #values = new Map();

  getPropertyValue(name) {
    return this.#values.get(name) || "";
  }

  setProperty(name, value) {
    this.#values.set(name, value);
  }

  removeProperty(name) {
    this.#values.delete(name);
  }
}

class FakeElement {
  #attributes = new Map();

  constructor(textContent = "", tagName = "SPAN") {
    this.textContent = textContent;
    this.tagName = tagName;
    this.style = new FakeStyle();
    this.isConnected = true;
    this.previousElementSibling = null;
    this.insertedElement = null;
  }

  closest() { return null; }

  getAttribute(name) { return this.#attributes.get(name) ?? null; }

  hasAttribute(name) { return this.#attributes.has(name); }

  removeAttribute(name) { this.#attributes.delete(name); }

  setAttribute(name, value) { this.#attributes.set(name, String(value)); }

  insertAdjacentElement(_position, element) {
    element.previousElementSibling = this;
    this.insertedElement = element;
    return element;
  }

  remove() { this.isConnected = false; }
}

function loadPolicy() {
  const start = '  if (location.hostname === "www.espn.co.uk"';
  const index = source.lastIndexOf(start);
  assert.notEqual(index, -1, "userscript bootstrap marker must exist");
  const testable = `${source.slice(0, index)}  globalThis.__spoilerfreeTest = {
    adapterId: (href) => adapters.find((adapter) => adapter.accepts(new URL(href)))?.id || null,
    adapter: (id) => adapters.find((adapter) => adapter.id === id),
    cricketScore: (text) => cricketScore({ textContent: text }),
    markHidden,
    markScore,
    nhlTeamResult: (text) => nhlTeamResult({ textContent: text }),
    numericScore: (text) => numericScore({ textContent: text }),
    preserveProtectedMutation,
    restoreElement,
    enabled: () => enabled,
  };
})();\n`;
  const context = {
    document: { createElement: () => new FakeElement() },
    Element: FakeElement,
    URL,
    getComputedStyle: () => ({ fontSize: "18px" }),
  };
  vm.createContext(context);
  vm.runInContext(testable, context, { filename: sourcePath });
  return context.__spoilerfreeTest;
}

test("starts enabled for every new document", () => {
  assert.equal(loadPolicy().enabled(), true);
});

test("matches every supported score surface and rejects nearby pages", () => {
  const policy = loadPolicy();
  const supported = new Map([
    ["https://www.fifa.com/en/tournaments/mens/worldcup/example/scores-fixtures", "fifa"],
    ["https://www.flashscore.com/football/", "flashscore"],
    ["https://www.flashscore.com/hockey/", "flashscore"],
    ["https://www.flashscore.com/team/chelsea/QiWDto1I/results/", "flashscore"],
    ["https://www.skysports.com/football-scores-fixtures/2026-07-11", "skysports"],
    ["https://www.skysports.com/football/features", "skysports"],
    ["https://www.skysports.com/manchester-city-scores-fixtures/2026-05-01", "skysports"],
    ["https://www.skysports.com/cricket/scores-fixtures/26-07-2026", "skysports-cricket"],
    ["https://www.cricbuzz.com/", "cricbuzz"],
    ["https://www.cricbuzz.com/cricket-schedule/upcoming-series/all", "cricbuzz"],
    ["https://www.cricbuzz.com/cricket-match/live-scores/recent-matches", "cricbuzz"],
    ["https://www.cricbuzz.com/cricket-series/123/example/matches", "cricbuzz"],
    ["https://www.espncricinfo.com/", "espncricinfo"],
    ["https://www.espncricinfo.com/story/example-123", "espncricinfo"],
    ["https://www.espncricinfo.com/live-cricket-match-results", "espncricinfo"],
    ["https://www.goal.com/en/live-scores", "goal"],
    ["https://www.goal.com/de/live-ergebnisse", "goal"],
    ["https://www.goal.com/it/livescore", "goal"],
    ["https://www.goal.com/fr/ligue-1/matches-resultats/example", "goal"],
    ["https://www.livescore.com/en/football/", "livescore"],
    ["https://www.livescore.com/en/football/brazil/serie-a/corinthians-vs-cruzeiro/1708641/", "livescore"],
    ["https://sports.yahoo.com/", "yahoo"],
    ["https://sports.yahoo.com/nba/scoreboard/?season=2025", "yahoo"],
    ["https://sports.yahoo.com/mlb/scoreboard/?season=2026&date=2026-08-17", "yahoo"],
    ["https://sports.yahoo.com/nfl/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/nhl/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/wnba/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/ncaaf/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/college-football/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/college-basketball/scoreboard/", "yahoo"],
    ["https://sports.yahoo.com/mlb/article/example", "yahoo"],
    ["https://www.espn.com/nba/scoreboard/_/date/20250622", "espn"],
    ["https://www.espn.com/nfl/scoreboard/_/week/18/year/2025/seasontype/2", "espn"],
    ["https://www.espn.co.uk/nba/scoreboard/_/date/20260614", "espn"],
    ["https://www.espn.co.uk/football/scoreboard", "espn"],
    ["https://www.espn.co.uk/nhl/resultados", "espn"],
    ["https://www.espn.com/nba/story/_/id/1/example", "espn"],
    ["https://www.espn.com/nba/team/schedule/_/name/ny/season/2026", "espn"],
    ["https://www.espn.co.uk/nba/recap/_/gameId/401810322", "espn"],
    ["https://www.espn.com/nba/game/_/gameId/401812480/76ers-knicks", "espn"],
    ["https://www.nba.com/games?date=2025-06-22", "nba"],
    ["https://www.nba.com/schedule", "nba"],
    ["https://www.nfl.com/scores/2025/week-18", "nfl"],
    ["https://www.nfl.com/news/example", "nfl"],
    ["https://www.nhl.com/scores/2025-04-17", "nhl"],
    ["https://www.nhl.com/de/scores/2025-04-17", "nhl"],
    ["https://www.nhl.com/schedule/2026-01-14", "nhl"],
    ["https://www.nhl.com/de/schedule/2026-01-14", "nhl"],
    ["https://www.nhl.com/fr/schedule/2026-01-14", "nhl"],
    ["https://www.nhl.com/devils/schedule/2026-01-14", "nhl"],
    ["https://www.nhl.com/devils/news/example", "nhl"],
    ["https://www.mlb.com/scores/2025-07-01", "mlb"],
    ["https://www.mlb.com/news/example", "mlb"],
    ["https://www.kicker.de/nhl/spieltag", "kicker"],
    ["https://www.kicker.de/beispiel-1017516/artikel", "kicker"],
    ["https://www.kicker.de/beispiel/analyse", "kicker"],
    ["https://www.kicker.de/beispiel/slideshow", "kicker"],
    ["https://www.kicker.de/news", "kicker"],
    ["https://www.google.com/search?q=nfl", "google"],
    ["https://www.google.de/search?q=bundesliga", "google"],
    ["https://sport.bild.de/", "sportbild"],
    ["https://m.sportdaten.sportbild.bild.de/fussball/bundesliga/ergebnisse/", "sportbild"],
    ["https://www.sofascore.com/basketball/2026-08-16", "sofascore"],
    ["https://www.sofascore.com/ice-hockey/2026-08-16", "sofascore"],
  ]);
  for (const [url, expected] of supported) assert.equal(policy.adapterId(url), expected, url);

  for (const url of [
    "https://www.google.com/",
    "https://sports.example.com/nba/scoreboard/",
    "https://example.com/scores",
  ]) {
    assert.equal(policy.adapterId(url), null, url);
  }
});

test("recognizes only isolated numeric scores", () => {
  const policy = loadPolicy();
  for (const score of ["91", "3:2", "12 - 5"]) assert.equal(policy.numericScore(score), true);
  for (const content of ["Final", "0-0 record", "13.04.2026", "Team 91"]) {
    assert.equal(policy.numericScore(content), false);
  }
});

test("recognizes NHL team-calendar results without matching dates or start times", () => {
  const policy = loadPolicy();
  for (const result of ["W 4-1", "L 3-2 (OT)", "W 2 - 1 (SO)"]) {
    assert.equal(policy.nhlTeamResult(result), true, result);
  }
  for (const content of ["19:30", "Jan 14", "vs.", "3 UTA"]) {
    assert.equal(policy.nhlTeamResult(content), false, content);
  }
});

test("recognizes audited cricket score formats without prose", () => {
  const policy = loadPolicy();
  for (const score of ["462", "171-0 (15.2)", "305 & 194", "158-8 (100 Balls)", "(20 ov, T:196) 189/6"]) {
    assert.equal(policy.cricketScore(score), true, score);
  }
  for (const content of ["Match starts at 18:00", "Defenders won by 6 runs", "Day 1: Stumps"]) {
    assert.equal(policy.cricketScore(content), false, content);
  }
});

test("flattens score accessibility and restores original attributes", () => {
  const policy = loadPolicy();
  const score = new FakeElement("103");
  score.setAttribute("aria-label", "103 points");
  score.setAttribute("role", "status");

  policy.markScore(score);

  assert.equal(score.getAttribute("data-candy-spoilerfree-score"), "—");
  assert.equal(score.getAttribute("aria-label"), "103 points");
  assert.equal(score.getAttribute("aria-hidden"), "true");
  assert.equal(score.getAttribute("role"), "status");
  assert.equal(score.insertedElement.textContent, "Ergebnis verborgen");
  assert.equal(score.insertedElement.getAttribute("data-candy-spoilerfree-accessible"), "");
  assert.equal(score.style.getPropertyValue("--candy-spoilerfree-font-size"), "18px");

  policy.restoreElement(score);
  assert.equal(score.getAttribute("data-candy-spoilerfree-score"), null);
  assert.equal(score.getAttribute("aria-label"), "103 points");
  assert.equal(score.getAttribute("aria-hidden"), null);
  assert.equal(score.getAttribute("role"), "status");
  assert.equal(score.insertedElement.isConnected, false);
});

test("does not insert invalid accessibility siblings beside table cells", () => {
  const policy = loadPolicy();
  const score = new FakeElement("99", "TD");

  policy.markScore(score);

  assert.equal(score.getAttribute("aria-hidden"), "true");
  assert.equal(score.insertedElement, null);
});

test("restores the page's latest aria-hidden value", () => {
  const policy = loadPolicy();
  const detail = new FakeElement("winner detail");
  policy.markHidden(detail);
  assert.equal(detail.getAttribute("aria-hidden"), "true");

  detail.setAttribute("aria-hidden", "false");
  policy.preserveProtectedMutation(detail, "aria-hidden");
  assert.equal(detail.getAttribute("aria-hidden"), "true");

  policy.restoreElement(detail);
  assert.equal(detail.getAttribute("aria-hidden"), "false");
});

test("ESPN policy covers main cards and the global header strip", () => {
  const espn = loadPolicy().adapter("espn");
  assert.ok(espn.scores.some((selector) => selector.startsWith(".Scoreboard ")));
  assert.ok(espn.scores.some((selector) => selector.startsWith(".HeaderScoreboard ")));
  assert.ok(espn.hidden.includes(".HeaderScoreboard .ScoreCell__WinnerIcon"));
});

test("Yahoo status scan ignores its own accessibility helpers", () => {
  assert.match(source, /!element\.hasAttribute\(marker\.accessible\)/);
  assert.match(source, /Final\(\?:\\s\*\\\/\\s\*/);
});

test("NFL score lookup skips the topping's inserted accessibility helper", () => {
  assert.match(
    source,
    /visualScore\?\.hasAttribute\(marker\.accessible\)[\s\S]{0,100}visualScore\.previousElementSibling/,
  );
});

test("Kicker hides complete subscore holders such as halftime scores", () => {
  assert.match(source, /scoreHolder--subscore/);
  assert.match(source, /markHidden\(subscore\)/);
});

test("dynamic score surfaces only activate after their audited component exists", () => {
  const policy = loadPolicy();
  const kicker = policy.adapter("kicker");
  const google = policy.adapter("google");
  const nba = policy.adapter("nba");
  const mlb = policy.adapter("mlb");
  const flashscore = policy.adapter("flashscore");
  const goal = policy.adapter("goal");
  const cricbuzz = policy.adapter("cricbuzz");
  const espncricinfo = policy.adapter("espncricinfo");
  const sky = policy.adapter("skysports");
  const skyCricket = policy.adapter("skysports-cricket");
  assert.equal(kicker.detects({ querySelectorAll: () => [] }), false);
  const kickerHolder = {
    querySelector: () => ({}),
    querySelectorAll: () => [{ textContent: "3" }, { textContent: "1" }],
  };
  assert.equal(kicker.detects({
    querySelectorAll: () => [{ querySelector: () => kickerHolder }],
  }), true);
  assert.equal(google.detects({ querySelector: () => null, querySelectorAll: () => [] }), false);
  assert.equal(google.detects({
    querySelector: (selector) => selector === "#sports-app" ? {} : null,
    querySelectorAll: (selector) => selector === ".ss-ms-cs" ? [{ textContent: "7" }] : [],
  }), true);
  assert.equal(nba.detects({ querySelector: () => null, querySelectorAll: () => [] }), false);
  assert.equal(nba.detects({ querySelector: () => ({}) }), true);
  assert.equal(nba.detects({
    querySelector: () => null,
    querySelectorAll: () => [{ textContent: "99" }],
  }), true);
  assert.equal(mlb.detects({ querySelector: () => null }), false);
  assert.equal(mlb.detects({ querySelector: () => ({}) }), true);
  for (const adapter of [flashscore, goal, cricbuzz, espncricinfo, sky, skyCricket]) {
    assert.equal(adapter.detects({ querySelectorAll: () => [] }), false, adapter.id);
  }
});

test("ESPN ignores placeholders and neutralizes shootout status", () => {
  const espn = loadPolicy().adapter("espn");
  assert.equal(espn.scoreFilter({ textContent: "-" }), false);
  assert.equal(espn.scoreFilter({ textContent: "4" }), true);
  assert.ok(espn.replacements.some(([, pattern, replacement]) => pattern.test("FT-Pens") && replacement === "FT"));
  assert.ok(espn.replacements.some(([, pattern, replacement]) => pattern.test("Final / 10") && replacement === "Final"));
  const notePattern = espn.conditionalHidden[0][1];
  assert.equal(notePattern.test("Preseason"), false);
  assert.equal(notePattern.test("Doubleheader - Game 1"), false);
  assert.equal(notePattern.test("NY wins series 4-1"), true);
});

test("ESPN desktop baseball hides runs without mistaking hits or errors for scores", () => {
  assert.match(
    source,
    /ScoreboardScoreCell_Linescores > \.ScoreboardScoreCell__Value:first-child/,
  );
  assert.match(source, /ScoreboardScoreCell__WinnerIcon/);
  assert.match(source, /Scoreboard__Performers/);
  assert.match(source, /Media__Caption__Title/);
});

test("ESPN covers team schedules and Prism game scoreboards", () => {
  assert.match(source, /Schedule__resultSymbol|data-testid="symbol"/);
  assert.match(source, /Gamestrip__StickyContainer/);
  assert.match(source, /data-testid="prism-Table"/);
  assert.match(source, /Probabilities and Game Flow/);
});

test("leaving NBA games restores the native score switch", () => {
  assert.match(
    source,
    /if \(adapterId !== currentAdapter\) \{\s*if \(currentAdapter === "nba"\) setNbaProtection\(false\);/,
  );
});

test("Flashscore neutralizes current and legacy winner cues", () => {
  assert.match(source, /\.event__participant, \[data-testid="wcl-matchRow-participant"\]/);
});

test("observes dynamic title spoilers such as cricket ticker results", () => {
  assert.match(source, /attributeFilter: \["aria-hidden", "aria-label", "role", "title"\]/);
});

test("does not add network access, remote code, or topping-owned storage", () => {
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /sessionStorage|indexedDB/);
  const storageKeys = [...source.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\("([^"]+)"/g)]
    .map((match) => match[1]);
  assert.ok(storageKeys.length > 0);
  assert.deepEqual(new Set(storageKeys), new Set(["hideScores"]));
  assert.doesNotMatch(source, /^\s*\/\/\s*@(require|resource|connect)\b/im);
});
