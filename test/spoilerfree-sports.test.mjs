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

  constructor(textContent = "") {
    this.textContent = textContent;
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
  const start = '  if (document.readyState === "loading") {';
  const index = source.lastIndexOf(start);
  assert.notEqual(index, -1, "userscript bootstrap marker must exist");
  const testable = `${source.slice(0, index)}  globalThis.__spoilerfreeTest = {
    adapterId: (href) => adapters.find((adapter) => adapter.accepts(new URL(href)))?.id || null,
    adapter: (id) => adapters.find((adapter) => adapter.id === id),
    cricketScore: (text) => cricketScore({ textContent: text }),
    markHidden,
    markScore,
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
    ["https://www.skysports.com/football-scores-fixtures/2026-07-11", "skysports"],
    ["https://www.cricbuzz.com/cricket-match/live-scores/recent-matches", "cricbuzz"],
    ["https://www.cricbuzz.com/cricket-series/123/example/matches", "cricbuzz"],
    ["https://www.espncricinfo.com/live-cricket-match-results", "espncricinfo"],
    ["https://www.goal.com/en/live-scores", "goal"],
    ["https://www.livescore.com/en/football/", "livescore"],
    ["https://sports.yahoo.com/nba/scoreboard/?season=2025", "yahoo-nba"],
    ["https://www.espn.com/nba/scoreboard/_/date/20250622", "espn"],
    ["https://www.nba.com/games?date=2025-06-22", "nba"],
    ["https://www.nfl.com/scores/2025/week-18", "nfl"],
    ["https://www.nhl.com/scores/2025-04-17", "nhl"],
    ["https://www.mlb.com/scores/2025-07-01", "mlb"],
    ["https://www.kicker.de/nhl/spieltag", "kicker"],
    ["https://sport.bild.de/", "sportbild"],
    ["https://m.sportdaten.sportbild.bild.de/fussball/bundesliga/ergebnisse/", "sportbild"],
    ["https://www.sofascore.com/basketball/2026-08-16", "sofascore"],
    ["https://www.sofascore.com/ice-hockey/2026-08-16", "sofascore"],
  ]);
  for (const [url, expected] of supported) assert.equal(policy.adapterId(url), expected, url);

  for (const url of [
    "https://www.espn.com/nba/story/_/id/1/example",
    "https://www.nba.com/schedule",
    "https://www.nfl.com/news/example",
    "https://www.kicker.de/news",
    "https://www.espncricinfo.com/series/example/full-scorecard",
    "https://www.goal.com/en/news/example",
    "https://sports.yahoo.com/nfl/scoreboard/",
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
  assert.match(
    source,
    /!element\.hasAttribute\(marker\.accessible\)[\s\S]{0,200}\^Final/,
  );
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
