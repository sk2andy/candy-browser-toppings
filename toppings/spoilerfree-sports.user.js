// ==UserScript==
// @name Spoilerfree Sports
// @description Hides scores and winner cues behind an accessible, full-width toggle on supported sports sites.
// @version 1.2.0
// @license MIT
// @match https://www.fifa.com/*/scores-fixtures*
// @match https://www.flashscore.com/*
// @match https://www.skysports.com/football-scores-fixtures*
// @match https://www.cricbuzz.com/cricket-match/live-scores*
// @match https://www.cricbuzz.com/cricket-series/*/*/matches*
// @match https://www.espncricinfo.com/live-cricket-score*
// @match https://www.espncricinfo.com/live-cricket-match-results*
// @match https://www.espncricinfo.com/live-cricket-match-schedule-fixtures*
// @match https://www.espncricinfo.com/series/*/match-schedule-fixtures-and-results*
// @match https://www.goal.com/*/live-scores*
// @match https://www.livescore.com/*
// @match https://sports.yahoo.com/*
// @match https://www.espn.com/*
// @match https://www.espn.co.uk/*
// @match https://www.nba.com/*
// @match https://www.nfl.com/*
// @match https://www.nhl.com/*
// @match https://www.mlb.com/*
// @match https://www.kicker.de/*
// @match https://www.google.com/search*
// @match https://www.google.de/search*
// @match https://sport.bild.de/*
// @match https://m.sport.bild.de/*
// @match https://sportdaten.sportbild.bild.de/*
// @match https://m.sportdaten.sportbild.bild.de/*
// @match https://www.sofascore.com/*
// @run-at document-start
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const ids = {
    host: "candy-spoilerfree-sports",
    style: "candy-spoilerfree-sports-style",
  };
  const marker = {
    score: "data-candy-spoilerfree-score",
    hidden: "data-candy-spoilerfree-hidden",
    label: "data-candy-spoilerfree-label",
    neutral: "data-candy-spoilerfree-neutral",
    accessible: "data-candy-spoilerfree-accessible",
  };
  const sportPaths = /^\/(?:$|football|basketball|tennis|ice-hockey|baseball|handball|volleyball|motorsport|cricket|rugby|futsal|darts|snooker|table-tennis|badminton|waterpolo|cycling|american-football)(?:\/|$)/;
  const flashscoreSportPaths = /^\/(?:$|football|basketball|tennis|hockey|baseball|handball|volleyball|motorsport|cricket|rugby|futsal|darts|snooker|table-tennis|badminton|waterpolo|cycling|american-football)(?:\/|$)/;
  const googleScoreSelectors = [
    ".imso_mh__l-tm-sc",
    ".imso_mh__r-tm-sc",
    ".ss-ms-cs",
  ];
  const resultWords = /\b(?:won|win|winning|beat|lead|leads|trail|trails|need|needs|require|requires|stumps?|draw|drawn|tied|abandon|no result|opt to)\b/i;
  const originalAttributes = new WeakMap();
  const protectedAttributeValues = new WeakMap();
  const accessibleScoreLabels = new WeakMap();
  const originalStylePresence = new WeakMap();
  const protectedElements = new Set();
  let staleElements = null;
  let enabled = true;
  let scheduled = false;
  let currentAdapter = "";
  let nativeNbaControl = null;
  let barHost = null;
  let switchButton = null;
  let statusText = null;

  const adapters = [
    {
      id: "fifa",
      accepts: (url) => url.hostname === "www.fifa.com" && /\/scores-fixtures(?:\/|$)/.test(url.pathname),
      custom: protectFifa,
    },
    {
      id: "flashscore",
      accepts: (url) => url.hostname === "www.flashscore.com" && flashscoreSportPaths.test(url.pathname),
      custom: protectFlashscore,
    },
    {
      id: "skysports",
      accepts: (url) => url.hostname === "www.skysports.com" && /^\/football-scores-fixtures(?:\/|$)/.test(url.pathname),
      custom: protectSkySports,
    },
    {
      id: "cricbuzz",
      accepts: (url) => url.hostname === "www.cricbuzz.com" && (
        /^\/cricket-match\/live-scores(?:\/(?:recent-matches|upcoming-matches))?\/?$/.test(url.pathname)
        || /^\/cricket-series\/\d+\/[^/]+\/matches\/?$/.test(url.pathname)
      ),
      custom: protectCricbuzz,
    },
    {
      id: "espncricinfo",
      accepts: (url) => url.hostname === "www.espncricinfo.com" && (
        /^\/live-cricket-(?:score|match-results|match-schedule-fixtures)\/?$/.test(url.pathname)
        || /^\/series\/[^/]+\/match-schedule-fixtures-and-results\/?$/.test(url.pathname)
      ),
      custom: protectEspnCricInfo,
    },
    {
      id: "goal",
      accepts: (url) => url.hostname === "www.goal.com" && /^\/[^/]+\/live-scores\/?$/.test(url.pathname),
      custom: protectGoal,
    },
    {
      id: "livescore",
      accepts: (url) => url.hostname === "www.livescore.com" && /^\/[a-z]{2}(?:-[a-z]{2})?\/(?:$|football|hockey|basketball|tennis|cricket)(?:\/|$)/i.test(url.pathname),
      custom: protectLiveScore,
    },
    {
      id: "yahoo",
      accepts: (url) => url.hostname === "sports.yahoo.com",
      detects: (documentRoot) => Boolean(documentRoot.querySelector(
        'a[data-ylk*="elm:game;"][data-ylk*="gameId:"]',
      )),
      custom: protectYahooSports,
    },
    {
      id: "espn",
      accepts: (url) => ["www.espn.com", "www.espn.co.uk"].includes(url.hostname),
      detects: (documentRoot) => Boolean(documentRoot.querySelector(".Scoreboard, .HeaderScoreboard")),
      scores: [
        ".Scoreboard .ScoreCell__Score:not(.ScoreCell__Score--record)",
        ".HeaderScoreboard .ScoreCell__Score:not(.ScoreCell__Score--record)",
      ],
      scoreFilter: numericScore,
      hidden: [
        ".Scoreboard .ScoreCell__WinnerIcon",
        ".HeaderScoreboard .ScoreCell__WinnerIcon",
      ],
      neutral: [
        ".Scoreboard .ScoreCell__Item--winner",
        ".Scoreboard .ScoreCell__Item--loser",
        ".HeaderScoreboard .ScoreCell__Item--winner",
        ".HeaderScoreboard .ScoreCell__Item--loser",
      ],
      replacements: [
        [".Scoreboard .ScoreCell__Time", /^Final\s*\/\s*(?:\d+|(?:\d+)?OT|SO)$/i, "Final"],
        [".HeaderScoreboard .ScoreCell__Time", /^Final\s*\/\s*(?:\d+|(?:\d+)?OT|SO)$/i, "Final"],
        [".Scoreboard .ScoreCell__Time", /^FT-Pens$/i, "FT"],
        [".HeaderScoreboard .ScoreCell__Time", /^FT-Pens$/i, "FT"],
      ],
      conditionalHidden: [
        [
          ".Scoreboard .ScoreCell__GameNote, .HeaderScoreboard .ScoreCell__GameNote",
          /\b(?:wins?|won|series|penalt|advance|eliminat|leads?)\b|\b\d+\s*-\s*\d+\b/i,
        ],
      ],
      custom: protectEspn,
    },
    {
      id: "nba",
      accepts: (url) => url.hostname === "www.nba.com",
      detects: (documentRoot) => Boolean(documentRoot.querySelector('input[name="showScores"]')),
      nativeNba: true,
    },
    {
      id: "nfl",
      accepts: (url) => url.hostname === "www.nfl.com",
      detects: (documentRoot) => [...documentRoot.querySelectorAll('span[data-testid="accessibility-label"]')]
        .some((element) => /^\s*\d+\s+points?\s*$/i.test(element.textContent || "")),
      custom: protectNfl,
    },
    {
      id: "nhl",
      accepts: (url) => url.hostname === "www.nhl.com",
      detects: (documentRoot) => Boolean(documentRoot.querySelector(
        ".game-card-container .team-score, .rt-table .gameResultColumnHeader",
      )) || [...documentRoot.querySelectorAll(".rt-table div")].some(nhlTeamResult),
      custom: protectNhl,
    },
    {
      id: "mlb",
      accepts: (url) => url.hostname === "www.mlb.com",
      detects: (documentRoot) => Boolean(documentRoot.querySelector('[data-test-mlb="singleGameContainer"]')),
      scores: [
        '[data-test-mlb="singleGameContainer"] [class*="MobileHomeScoreWrapper"]',
        '[data-test-mlb="singleGameContainer"] [class*="MobileAwayScoreWrapper"]',
        '[data-test-mlb="singleGameContainer"] [class*="CondensedScoreLine"] > span',
      ],
      scoreFilter: numericScore,
      hidden: [
        '[data-test-mlb="singleGameContainer"] table',
        '[data-test-mlb="singleGameContainer"] .matchup-wrapper',
      ],
      labels: [
        '[data-test-mlb="singleGameContainer"] a[href^="/gameday/"][aria-label]',
        '[data-test-mlb="singleGameContainer"] [data-test-mlb="gameStartTimesStateLabel"][aria-label]',
        '[data-test-mlb="singleGameContainer"] [data-mlb-test="gameStartTimesStateLabel"][aria-label]',
      ],
      labelFilter: (element) => /\b(?:beat|defeat|won|winning|leads?|runs? to|points? to)\b|\b\d+\s*(?:-|to)\s*\d+\b/i.test(element.getAttribute("aria-label") || ""),
    },
    {
      id: "kicker",
      accepts: (url) => url.hostname === "www.kicker.de",
      detects: kickerHasScore,
      custom: protectKicker,
    },
    {
      id: "google",
      accepts: (url) => ["www.google.com", "www.google.de"].includes(url.hostname)
        && url.pathname === "/search",
      detects: (documentRoot) => Boolean(documentRoot.querySelector("#sports-app"))
        && googleScoreSelectors.some((selector) => (
          [...documentRoot.querySelectorAll(selector)].some((element) => /\d/.test(element.textContent || ""))
        )),
      custom: protectGoogle,
    },
    {
      id: "sportbild",
      accepts: (url) => [
        "sport.bild.de",
        "m.sport.bild.de",
        "sportdaten.sportbild.bild.de",
        "m.sportdaten.sportbild.bild.de",
      ].includes(url.hostname),
      custom: protectSportBild,
    },
    {
      id: "sofascore",
      accepts: (url) => url.hostname === "www.sofascore.com" && sportPaths.test(url.pathname),
      custom: protectSofaScore,
    },
  ];

  function numericScore(element) {
    return /^\s*\d+(?:\s*[-:]\s*\d+)?\s*$/.test(element.textContent || "");
  }

  function nhlTeamResult(element) {
    return /^[WLOT]\s+\d+\s*-\s*\d+(?:\s*\((?:OT|SO)\))?$/i.test((element.textContent || "").trim());
  }

  function kickerHasScore(documentRoot) {
    return [...documentRoot.querySelectorAll(
      ".kick__v100-gameList__gameRow a.kick__v100-scoreBoard",
    )].some((scoreboard) => {
      const holder = scoreboard.querySelector(
        ".kick__v100-scoreBoard__scoreHolder:not(.kick__v100-scoreBoard__scoreHolder--subscore)",
      );
      if (!holder) return false;
      const scores = holder.querySelectorAll(".kick__v100-scoreBoard__scoreHolder__score");
      return scores.length === 2
        && Boolean(holder.querySelector(".kick__v100-scoreBoard__scoreHolder__divider"))
        && [...scores].every(numericScore);
    });
  }

  function saveAttribute(element, name) {
    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    if (!attributes.has(name)) {
      attributes.set(name, element.hasAttribute(name) ? element.getAttribute(name) : null);
    }
  }

  function setProtectedAttribute(element, name, value) {
    saveAttribute(element, name);
    let values = protectedAttributeValues.get(element);
    if (!values) {
      values = new Map();
      protectedAttributeValues.set(element, values);
    }
    values.set(name, value);
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function registerProtected(element) {
    protectedElements.add(element);
    staleElements?.delete(element);
  }

  function preserveProtectedMutation(element, name) {
    const attributes = originalAttributes.get(element);
    const protectedValue = protectedAttributeValues.get(element)?.get(name);
    const current = element.getAttribute(name);
    if (!attributes?.has(name) || protectedValue === undefined || current === protectedValue) return;
    attributes.set(name, current);
    element.setAttribute(name, protectedValue);
  }

  function markScore(element, placeholderOverride = "", accessibleLabel = "Ergebnis verborgen") {
    if (!(element instanceof Element) || element.closest(`#${ids.host}`)) return;
    if (!originalStylePresence.has(element)) originalStylePresence.set(element, element.hasAttribute("style"));
    const fontSize = element.style.getPropertyValue("--candy-spoilerfree-font-size")
      || getComputedStyle(element).fontSize;
    setProtectedAttribute(element, "aria-hidden", "true");
    let label = accessibleScoreLabels.get(element);
    if (!label?.isConnected || label.previousElementSibling !== element) {
      label?.remove();
      label = document.createElement("span");
      label.setAttribute(marker.accessible, "");
      element.insertAdjacentElement("afterend", label);
      accessibleScoreLabels.set(element, label);
    }
    if (label.textContent !== accessibleLabel) label.textContent = accessibleLabel;
    const combined = /[-:]/.test(element.textContent || "");
    const placeholder = placeholderOverride || (combined ? "— : —" : "—");
    if (element.getAttribute(marker.score) !== placeholder) element.setAttribute(marker.score, placeholder);
    element.style.setProperty("--candy-spoilerfree-font-size", fontSize);
    registerProtected(element);
  }

  function markHidden(element) {
    if (!(element instanceof Element) || element.closest(`#${ids.host}`)) return;
    setProtectedAttribute(element, "aria-hidden", "true");
    if (!element.hasAttribute(marker.hidden)) element.setAttribute(marker.hidden, "");
    registerProtected(element);
  }

  function markLabel(element) {
    if (!(element instanceof Element) || element.closest(`#${ids.host}`)) return;
    setProtectedAttribute(element, "aria-label", "Spielstand verborgen");
    if (!element.hasAttribute(marker.label)) element.setAttribute(marker.label, "");
    registerProtected(element);
  }

  function markNeutral(element) {
    if (!(element instanceof Element) || element.closest(`#${ids.host}`)) return;
    if (!element.hasAttribute(marker.neutral)) element.setAttribute(marker.neutral, "");
    registerProtected(element);
  }

  function queryAll(selectors, root = document) {
    const found = new Set();
    for (const selector of selectors || []) {
      if (root instanceof Element && root.matches(selector)) found.add(root);
      root.querySelectorAll(selector).forEach((element) => found.add(element));
    }
    return found;
  }

  function protectFifa(root) {
    queryAll(['a[href*="/match-centre/match/"]'], root).forEach((match) => {
      match.querySelectorAll(
        'span[class*="match-row_score__"], span[class*="match-row_penalties__"]',
      ).forEach((element) => {
        if (/\d/.test(element.textContent || "")) markScore(element);
      });
      match.querySelectorAll(
        '[class*="match-row_scoreWinner__"], [class*="match-row_scoreLoser__"]',
      ).forEach(markNeutral);
    });
  }

  function protectFlashscore(root) {
    queryAll([".event__match[data-event-row]"], root).forEach((match) => {
      const scores = [...match.querySelectorAll(".event__score")];
      if (!scores.some((element) => /\d/.test(element.textContent || ""))) return;
      scores.forEach((element) => {
        if (/\d/.test(element.textContent || "")) markScore(element);
      });
      match.querySelectorAll(".event__stage").forEach((element) => {
        if (/after (?:et|pen\.)|penalties|extra time/i.test(element.textContent || "")) {
          markScore(element, "Finished", "Finished");
        }
      });
      match.querySelectorAll('[data-testid="wcl-icon-incidents-next-stage"]').forEach(markHidden);
      match.querySelectorAll(
        '.event__participant, [data-testid="wcl-matchRow-participant"] [data-testid="wcl-scores-simple-text-01"]',
      ).forEach(markNeutral);
    });
  }

  function protectSkySports(root) {
    queryAll([".ui-sport-match-score[data-match-state]"], root).forEach((match) => {
      if (!/^(?:live|post)$/.test(match.getAttribute("data-match-state") || "")) return;
      match.querySelectorAll(".ui-sport-match-score__score").forEach((element) => {
        if (/\d/.test(element.textContent || "")) markScore(element);
      });
      match.querySelectorAll(".ui-sport-match-score__status").forEach((element) => {
        if (/\bAET\b|extra time/i.test(element.textContent || "")) markScore(element, "FT", "Final");
      });
      match.querySelectorAll(".ui-sport-match-score__summary").forEach((element) => {
        if (/penalt|\bwin(?:s|ner)?\b|\bwon\b/i.test(element.textContent || "")) markHidden(element);
      });
      match.querySelectorAll(".ui-sport-match-score__audio-description").forEach(markHidden);
    });
  }

  function cricketScore(element) {
    const text = (element.textContent || "").trim();
    return /^\d+(?:-\d+|\/\d+|\/\d+d)?(?:\s*&\s*\d+(?:-\d+|\/\d+)?)?(?:\s*\((?:\d+(?:\.\d+)?|[^)]*(?:ov|balls?|T:)[^)]*)\))?$/i.test(text)
      || /^\([^)]*(?:ov|T:)[^)]*\)\s*\d+(?:\/\d+|\/\d+d)?(?:\s*&\s*\d+(?:\/\d+)?)?$/i.test(text);
  }

  function protectCricbuzz(root) {
    queryAll(['a[href^="/live-cricket-scores/"]'], root).forEach((card) => {
      const hasCardStatus = card.querySelector(".text-cbComplete, .text-cbLive, .text-cbPreview");
      if (!hasCardStatus) {
        if (resultWords.test(card.getAttribute("title") || "")) markHidden(card);
        return;
      }
      card.querySelectorAll("span.font-medium.truncate").forEach((element) => {
        if (!element.classList.contains("w-1/2") || !cricketScore(element)) return;
        markScore(element);
        if (element.parentElement) markNeutral(element.parentElement);
      });
      card.querySelectorAll(".text-cbComplete, .text-cbLive").forEach(markHidden);
      card.querySelectorAll(".text-cbPreview").forEach((element) => {
        if (resultWords.test(element.textContent || "")) markHidden(element);
      });
    });
  }

  function protectEspnCricInfo(root) {
    queryAll(["a.ds-no-tap-higlight"], root).forEach((card) => {
      const teams = [...card.querySelectorAll(".ci-team-score")];
      if (teams.length === 0) return;
      teams.forEach((team) => {
        const score = team.querySelector(":scope > .ds-text-right.ds-whitespace-nowrap")
          || team.querySelector(":scope > div:last-child");
        if (score && /\d/.test(score.textContent || "")) markScore(score);
        markNeutral(team);
        team.querySelectorAll("i.icon-dot_circular").forEach(markHidden);
      });
      card.querySelectorAll("p.ds-text-tight-s.ds-font-medium").forEach(markHidden);
    });
  }

  function protectGoal(root) {
    queryAll([".fco-match-list-item[data-match-id]"], root).forEach((match) => {
      match.querySelectorAll(".fco-team-score__value").forEach((element) => {
        if (numericScore(element)) markScore(element);
      });
      match.querySelectorAll(".fco-match-penalty-score").forEach((element) => {
        if (/\d+\s*[-:]\s*\d+/.test(element.textContent || "")) {
          markScore(element, "pen — : —", "Penalty result hidden");
        }
      });
    });
  }

  function protectLiveScore(root) {
    queryAll(['a[href]'], root).forEach((match) => {
      const href = match.getAttribute("href") || "";
      if (!/^\/[a-z]{2}(?:-[a-z]{2})?\/(?:football|hockey|basketball|tennis|cricket)\/.+\/\d+\/$/i.test(href)) return;
      [...match.querySelectorAll("div")].forEach((container) => {
        const children = [...container.children].filter((child) => !child.hasAttribute(marker.accessible));
        if (children.length !== 2 || !children.every((child) => numericScore(child))) return;
        children.forEach((child) => markScore(child));
      });
      match.querySelectorAll("svg title").forEach((title) => {
        if (/^(?:pen|winner)$/i.test((title.textContent || "").trim())) markHidden(title.closest("svg") || title);
      });
      match.querySelectorAll("span").forEach((element) => {
        if (element.children.length === 0 && /^(?:AP|AET)$/i.test((element.textContent || "").trim())) {
          markScore(element, "FT", "Final");
        }
      });
    });
  }

  function protectYahooSports(root) {
    queryAll(['a[data-ylk*="elm:game;"][data-ylk*="gameId:"]'], root).forEach((game) => {
      const regularScores = [...game.querySelectorAll("div")].filter((element) => (
        /^\d+$/.test((element.textContent || "").trim())
        && [...element.children].every((child) => child.tagName === "SPAN" && /^\d+$/.test((child.textContent || "").trim()))
        && element.nextElementSibling?.tagName === "SPAN"
        && [...(element.parentElement?.children || [])].filter((child) => !child.hasAttribute(marker.accessible)).length === 2
      ));
      const compactScores = (game.getAttribute("data-ylk") || "").includes("sec:featured-module;")
        ? [...game.querySelectorAll("div > span")].filter((element) => (
          /^\d+$/.test((element.textContent || "").trim())
          && element.children.length === 0
          && (!element.nextElementSibling || element.nextElementSibling.hasAttribute(marker.accessible))
          && Boolean(element.parentElement?.querySelector(":scope > div img, :scope > div picture"))
        ))
        : [];
      const scores = regularScores.length === 2 ? regularScores : compactScores;
      if (scores.length !== 2) return;
      scores.forEach((score) => {
        markScore(score);
        if (score.parentElement?.parentElement) markNeutral(score.parentElement.parentElement);
      });
      game.querySelectorAll('svg[data-icon^="win-indicator"]').forEach(markHidden);
      game.querySelectorAll("span").forEach((element) => {
        if (
          !element.hasAttribute(marker.accessible)
          && element.children.length === 0
          && /^(?:Final(?:\s*\/\s*(?:(?:\d+)?OT|\d+))?|FT(?:\s+PENS)?)$/i.test((element.textContent || "").trim())
        ) {
          markScore(element, "Final", "Final");
        }
      });
      [...game.querySelectorAll("div, span")].forEach((element) => {
        if (
          element.children.length === 0
          && /^(?:W|L|S):\s*\S/i.test((element.textContent || "").trim())
        ) {
          markHidden(element.parentElement || element);
        }
      });
    });
    queryAll(["h1", "h2", "h3", "h4", "h5", "h6", "span"], root).forEach((element) => {
      if (element.children.length === 0 && /\b(?:wins series|series tied)\b/i.test(element.textContent || "")) {
        markHidden(element);
      }
    });
    queryAll(['a[data-ylk*="sec:game-break;"]'], root).forEach((element) => {
      if (/\b(?:wins?|won|close out|eliminat|advance|beat)\b/i.test(element.textContent || "")) markHidden(element);
    });
  }

  function protectEspn(root) {
    queryAll([".Scoreboard"], root).forEach((scoreboard) => {
      const scores = [...scoreboard.querySelectorAll(
        ".ScoreboardScoreCell__Item .ScoreboardScoreCell_Linescores > .ScoreboardScoreCell__Value:first-child",
      )].filter(numericScore);
      if (scores.length === 0) return;
      scores.forEach((element) => markScore(element));
      scoreboard.querySelectorAll(".ScoreboardScoreCell__WinnerIcon").forEach(markHidden);
      scoreboard.querySelectorAll(
        ".ScoreboardScoreCell__Item--winner, .ScoreboardScoreCell__Item--loser",
      ).forEach(markNeutral);
      scoreboard.querySelectorAll(".ScoreboardScoreCell__Note").forEach((element) => {
        if (/\b(?:wins?|won|series|penalt|advance|eliminat|leads?)\b|\b\d+\s*-\s*\d+\b/i.test(element.textContent || "")) {
          markHidden(element);
        }
      });
      scoreboard.querySelectorAll(".Scoreboard__Performers").forEach((element) => {
        if (/^(?:WIN|LOSS|SAVE)/i.test((element.textContent || "").trim())) markHidden(element);
      });
      scoreboard.querySelectorAll(".ScoreboardScoreCell__Time").forEach((element) => {
        if (/\b(?:OT|SO|Pens)\b|^Final\s*\/\s*\d+$/i.test(element.textContent || "")) {
          markScore(element, "Final", "Final");
        }
      });
    });
    queryAll([".Media__Caption__Title"], root).forEach((element) => {
      if (resultWords.test(element.textContent || "") || /\b\d+\s*[-:]\s*\d+\b/.test(element.textContent || "")) {
        markHidden(element);
      }
    });
  }

  function protectNfl(root) {
    queryAll(['span[data-testid="accessibility-label"]'], root).forEach((label) => {
      if (!/^\s*\d+\s+points?\s*$/i.test(label.textContent || "")) return;
      markHidden(label);
      let visualScore = label.previousElementSibling;
      if (visualScore?.hasAttribute(marker.accessible)) visualScore = visualScore.previousElementSibling;
      if (visualScore && numericScore(visualScore)) markScore(visualScore);
      const card = label.closest("li");
      if (!card) return;
      const gameLink = [...card.querySelectorAll("a[data-analytics]")].find((link) => {
        try {
          return JSON.parse(link.dataset.analytics).linkModule === "Game Card";
        } catch {
          return false;
        }
      });
      if (!gameLink) {
        restoreElement(label);
        protectedElements.delete(label);
        if (visualScore) {
          restoreElement(visualScore);
          protectedElements.delete(visualScore);
        }
        return;
      }
      card.querySelectorAll("title").forEach((title) => {
        if (/winner indicator/i.test(title.textContent || "")) markHidden(title.closest("svg") || title);
      });
      card.querySelectorAll(".text-black, .text-ls-600").forEach(markNeutral);
    });
  }

  function protectNhl(root) {
    queryAll([".game-card-container"], root).forEach((card) => {
      card.querySelectorAll(".team-score").forEach((element) => {
        if (numericScore(element)) markScore(element);
      });
      card.querySelectorAll(".goal-chip").forEach(markHidden);
      card.querySelectorAll(".game-state-container").forEach((element) => {
        if (/\b(?:OT|SO)\b/i.test(element.textContent || "")) markScore(element, "FINAL", "Final");
      });
    });

    queryAll([".rt-table"], root).forEach((table) => {
      if (!table.querySelector(".gameResultColumnHeader")) return;
      table.querySelectorAll(".rt-tbody .rt-tr").forEach((row) => {
        const resultCell = row.querySelector(":scope > td.fullWidth");
        if (!resultCell) return;
        const resultPattern = /^\s*[A-ZÀ-Ž]{2,4}\s+\d+\s*,\s*[A-ZÀ-Ž]{2,4}\s+\d+(?:\s*\((?:OT|SO)\))?\s*$/i;
        const resultNodes = [...resultCell.querySelectorAll("span, div")].filter((element) => (
          resultPattern.test(element.textContent || "")
          && ![...element.children].some((child) => resultPattern.test(child.textContent || ""))
        ));
        if (resultNodes.length === 0) return;
        resultNodes.forEach((element) => markScore(element));
        const detailCell = resultCell.nextElementSibling;
        if (detailCell && !detailCell.classList.contains("gameLinksColumn")) markHidden(detailCell);
      });
    });

    queryAll([".rt-table div"], root).forEach((element) => {
      if (nhlTeamResult(element)) markScore(element);
    });
  }

  function protectKicker(root) {
    const rows = queryAll([".kick__v100-gameList__gameRow"], root);
    rows.forEach((row) => {
      row.querySelectorAll("a.kick__v100-scoreBoard").forEach((scoreboard) => {
        const holder = scoreboard.querySelector(
          ".kick__v100-scoreBoard__scoreHolder:not(.kick__v100-scoreBoard__scoreHolder--subscore)",
        );
        if (!holder) return;
        const scores = holder.querySelectorAll(".kick__v100-scoreBoard__scoreHolder__score");
        const divider = holder.querySelector(".kick__v100-scoreBoard__scoreHolder__divider");
        if (scores.length !== 2 || !divider || ![...scores].every(numericScore)) return;
        markScore(holder);
        scoreboard.querySelectorAll(".kick__v100-scoreBoard__scoreHolder--subscore").forEach((subscore) => {
          if (/\d+\s*:\s*\d+/.test(subscore.textContent || "")) {
            markHidden(subscore);
            return;
          }
          subscore.querySelectorAll(".kick__v100-scoreBoard__scoreHolder__text").forEach((element) => {
            if (/^(?:OT|n\.P\.|n\.V\.)$/i.test((element.textContent || "").trim())) markHidden(element);
          });
        });
      });
    });
  }

  function protectGoogle(root) {
    const sportsRoot = root instanceof Element && root.matches("#sports-app")
      ? root
      : root.querySelector("#sports-app");
    if (!sportsRoot) return;
    queryAll(googleScoreSelectors, sportsRoot).forEach((element) => {
      if (/\d/.test(element.textContent || "")) markScore(element);
    });
    queryAll([".imso_mh__score-sum.imso-ani"], sportsRoot).forEach((element) => {
      if (/\d/.test(element.textContent || "")) markHidden(element);
    });
    queryAll(["td.imspo_mt__rg > svg"], sportsRoot).forEach(markHidden);
    queryAll([
      ".imso_mh__first-tn-ed[data-df-team-mid]",
      ".imso_mh__second-tn-ed[data-df-team-mid]",
    ], sportsRoot).forEach(markNeutral);
  }

  function protectSportBild(root) {
    queryAll([".match[data-match_id]"], root).forEach((match) => {
      if (!match.matches(".finished, .live") && !match.querySelector(".match-result")) return;
      match.querySelectorAll(":scope > .match-result, :scope > .match-result-intermediate").forEach((element) => {
        if (numericScore(element) || /\d+\s*[-:]\s*\d+/.test(element.textContent || "")) markScore(element);
      });
      match.querySelectorAll(":scope > .match-result-home, :scope > .match-result-away").forEach((element) => {
        if (numericScore(element)) markScore(element);
      });
      match.querySelectorAll(":scope > .hs-winner").forEach(markNeutral);
      match.querySelectorAll(":scope > .match-incident, :scope > .match-result-intermediate .match-incident").forEach((element) => {
        if (/n\.(?:v|p)\.|verlängerung|penalty/i.test(element.textContent || "")) markHidden(element);
      });
    });
  }

  function protectSofaScore(root) {
    queryAll(["a[data-id]"], root).forEach((event) => {
      if (!/\/match\//.test(event.getAttribute("href") || "")) return;
      let hasScore = false;
      event.querySelectorAll("span.score").forEach((element) => {
        if (numericScore(element)) {
          markScore(element);
          hasScore = true;
        } else if (/^(?:AET|Aw\. Pen\.|After Penalties)$/i.test((element.textContent || "").trim())) {
          markHidden(element);
        }
      });
      if (!hasScore) return;
      event.querySelectorAll('[title$="live score"] bdi').forEach(markNeutral);
    });
  }

  function restoreElement(element) {
    if (!(element instanceof Element)) return;
    element.removeAttribute(marker.score);
    element.removeAttribute(marker.hidden);
    element.removeAttribute(marker.label);
    element.removeAttribute(marker.neutral);
    element.style.removeProperty("--candy-spoilerfree-font-size");
    if (originalStylePresence.get(element) === false && !element.getAttribute("style")?.trim()) {
      element.removeAttribute("style");
    }
    originalStylePresence.delete(element);
    const attributes = originalAttributes.get(element);
    if (attributes) {
      for (const [name, value] of attributes) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
      originalAttributes.delete(element);
    }
    protectedAttributeValues.delete(element);
    accessibleScoreLabels.get(element)?.remove();
    accessibleScoreLabels.delete(element);
  }

  function restoreAll() {
    protectedElements.forEach(restoreElement);
    protectedElements.clear();
  }

  function findAdapter() {
    const url = new URL(location.href);
    return adapters.find((adapter) => (
      adapter.accepts(url) && (!adapter.detects || adapter.detects(document))
    )) || null;
  }

  function nbaScoresHidden(control) {
    const activeLabel = control.closest("label") || control.parentElement;
    const labelText = activeLabel?.textContent || "";
    if (/hide scores/i.test(labelText)) return control.checked;
    if (/show scores/i.test(labelText)) return !control.checked;
    return control.checked;
  }

  function setNbaProtection(shouldHide) {
    const control = document.querySelector('input[name="showScores"]');
    nativeNbaControl = control;
    if (!control || nbaScoresHidden(control) === shouldHide) return Boolean(control);
    let storedValue = null;
    let hadStoredValue = false;
    try {
      storedValue = localStorage.getItem("hideScores");
      hadStoredValue = storedValue !== null;
    } catch {
      // NBA's native switch still works when site storage is unavailable.
    }
    control.click();
    const restorePreference = () => {
      try {
        if (hadStoredValue) localStorage.setItem("hideScores", storedValue);
        else localStorage.removeItem("hideScores");
      } catch {
        // The current document remains protected without storage access.
      }
    };
    restorePreference();
    setTimeout(restorePreference, 0);
    return true;
  }

  function protectWithAdapter(adapter, root) {
    if (adapter.nativeNba) {
      if (setNbaProtection(true)) registerProtected(nativeNbaControl);
      return;
    }
    queryAll(adapter.scores, root).forEach((element) => {
      if (!adapter.scoreFilter || adapter.scoreFilter(element)) markScore(element);
    });
    queryAll(adapter.hidden, root).forEach(markHidden);
    queryAll(adapter.labels, root).forEach((element) => {
      if (!adapter.labelFilter || adapter.labelFilter(element)) markLabel(element);
    });
    queryAll(adapter.neutral, root).forEach(markNeutral);
    for (const [selector, pattern] of adapter.conditionalHidden || []) {
      queryAll([selector], root).forEach((element) => {
        if (pattern.test(element.textContent || "")) markHidden(element);
      });
    }
    for (const [selector, pattern, replacement] of adapter.replacements || []) {
      queryAll([selector], root).forEach((element) => {
        if (pattern.test(element.textContent || "")) markScore(element, replacement, replacement);
      });
    }
    if (adapter.custom) adapter.custom(root);
  }

  function updateBar() {
    if (!switchButton || !statusText) return;
    switchButton.setAttribute("aria-checked", String(enabled));
    switchButton.classList.toggle("on", enabled);
    const detected = protectedElements.size > 0;
    statusText.textContent = enabled
      ? detected ? "Ergebnisse verborgen" : "Noch keine Ergebnisse erkannt"
      : "Ergebnisse sichtbar";
  }

  function scan(root = document) {
    for (const element of protectedElements) {
      if (!element.isConnected) {
        restoreElement(element);
        protectedElements.delete(element);
      }
    }
    const adapter = findAdapter();
    if (adapter && !barHost?.isConnected) installBar();
    if (!adapter && barHost?.isConnected) removeBar();
    const adapterId = adapter?.id || "";
    if (adapterId !== currentAdapter) {
      if (currentAdapter === "nba") setNbaProtection(false);
      restoreAll();
      currentAdapter = adapterId;
    }
    if (enabled && adapter) {
      staleElements = new Set(protectedElements);
      protectWithAdapter(adapter, root);
      for (const element of staleElements) {
        restoreElement(element);
        protectedElements.delete(element);
      }
      staleElements = null;
    }
    updateBar();
  }

  function scheduleScan(root = document) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan(root.isConnected === false ? document : root);
    });
  }

  function toggleProtection() {
    enabled = !enabled;
    if (enabled) {
      scan();
    } else {
      if (currentAdapter === "nba") setNbaProtection(false);
      restoreAll();
      updateBar();
    }
  }

  function installStyle() {
    if (document.getElementById(ids.style)) return;
    const style = document.createElement("style");
    style.id = ids.style;
    style.textContent = `
      [${marker.score}] {
        color: transparent !important;
        font-size: 0 !important;
        text-shadow: none !important;
      }
      [${marker.score}]::after {
        color: #79747e !important;
        content: attr(${marker.score}) !important;
        display: inline !important;
        font-size: var(--candy-spoilerfree-font-size, 1rem) !important;
        font-variant-numeric: tabular-nums;
        font-weight: 700 !important;
        letter-spacing: normal !important;
        line-height: inherit !important;
        text-indent: 0 !important;
        white-space: nowrap !important;
      }
      [${marker.score}] > * { display: none !important; }
      [${marker.hidden}] { display: none !important; }
      [${marker.accessible}] {
        block-size: 1px !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        inline-size: 1px !important;
        margin: -1px !important;
        overflow: hidden !important;
        padding: 0 !important;
        position: absolute !important;
        white-space: nowrap !important;
      }
      [${marker.neutral}],
      [${marker.neutral}] * {
        color: inherit !important;
        font-weight: inherit !important;
        opacity: 1 !important;
      }
    `;
    (document.head || document.documentElement).append(style);
  }

  function installBar() {
    if (!document.body || !findAdapter() || document.getElementById(ids.host)) return;
    barHost = document.createElement("div");
    barHost.id = ids.host;
    barHost.setAttribute("data-candy-topping", "spoilerfree-sports");
    const shadow = barHost.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          inline-size: 100%;
          position: sticky;
          inset-block-start: 0;
          z-index: 2147483647;
        }
        * { box-sizing: border-box; }
        button {
          align-items: center;
          background: #e8deff;
          border: 0;
          border-block-end: 1px solid #d0c4ea;
          color: #21005d;
          cursor: pointer;
          display: flex;
          font: 500 15px/20px system-ui, -apple-system, sans-serif;
          gap: 12px;
          inline-size: 100%;
          min-block-size: 64px;
          padding: 10px max(16px, env(safe-area-inset-right)) 10px max(16px, env(safe-area-inset-left));
          text-align: start;
          transition: background 240ms cubic-bezier(.2, 0, 0, 1), color 240ms cubic-bezier(.2, 0, 0, 1);
          -webkit-tap-highlight-color: transparent;
        }
        button:not(.on) { background: #f0e7ec; color: #49454f; }
        button:focus-visible { outline: 3px solid #6750a4; outline-offset: -3px; }
        .icon { block-size: 24px; flex: 0 0 24px; inline-size: 24px; }
        .copy { flex: 1; min-inline-size: 0; }
        .title { display: block; font-size: 16px; font-weight: 700; line-height: 21px; }
        .status { display: block; font-size: 12px; line-height: 17px; opacity: .78; }
        .track {
          align-items: center;
          background: #79747e;
          border: 2px solid #79747e;
          border-radius: 16px;
          display: flex;
          flex: 0 0 52px;
          inline-size: 52px;
          justify-content: flex-start;
          block-size: 32px;
          padding: 2px;
          transition: background 260ms cubic-bezier(.2, 0, 0, 1), border-radius 180ms ease;
        }
        .thumb {
          background: #fff;
          border-radius: 50%;
          block-size: 24px;
          inline-size: 24px;
          transform: translateX(0);
          transition: transform 280ms cubic-bezier(.2, .9, .2, 1.15), border-radius 180ms ease;
        }
        button.on .track { background: #6750a4; border-color: #6750a4; }
        button.on .thumb { transform: translateX(20px); }
        button:active .track, button:active .thumb { border-radius: 10px; }
        @media (prefers-color-scheme: dark) {
          button { background: #4c3795; border-color: #6750a4; color: #eaddff; }
          button:not(.on) { background: #30282d; color: #e8e0e5; }
          .track { background: #938f99; border-color: #938f99; }
          button.on .track { background: #d0bcff; border-color: #d0bcff; }
          button.on .thumb { background: #381e72; }
        }
        @media (prefers-reduced-motion: reduce) {
          button, .track, .thumb { transition: none; }
        }
      </style>
      <button type="button" role="switch" aria-checked="true" aria-label="Spoilerfreie Ergebnisse ein- oder ausschalten">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-3.1-3.1A11.7 11.7 0 0 1 12 20C6.5 20 2.2 16.6.6 12a12.7 12.7 0 0 1 3.1-4.8L2.1 5.6V3.5Zm3 5.1A10.5 10.5 0 0 0 2.8 12c1.5 3.5 4.9 6 9.2 6 1.4 0 2.7-.3 3.8-.7l-2-2a4 4 0 0 1-5.1-5.1L5.1 8.6Zm4.8 3 .1.4a2 2 0 0 0 2 2l.4-.1-2.5-2.3ZM12 4c5.5 0 9.8 3.4 11.4 8a12 12 0 0 1-2.7 4.4L19.3 15a10 10 0 0 0 1.9-3c-1.5-3.5-4.9-6-9.2-6-.9 0-1.7.1-2.5.3L7.9 4.7C9.2 4.2 10.6 4 12 4Zm-.2 4H12a4 4 0 0 1 4 4v.2L11.8 8Z"/>
        </svg>
        <span class="copy">
          <span class="title">Spoilerfrei</span>
          <span class="status" aria-live="polite">Ergebnisse verborgen</span>
        </span>
        <span class="track" aria-hidden="true"><span class="thumb"></span></span>
      </button>
    `;
    switchButton = shadow.querySelector("button");
    statusText = shadow.querySelector(".status");
    switchButton.addEventListener("click", toggleProtection);
    document.body.prepend(barHost);
    updateBar();
  }

  function removeBar() {
    barHost?.remove();
    barHost = null;
    switchButton = null;
    statusText = null;
  }

  function start() {
    installStyle();
    if (document.body) installBar();
    const observer = new MutationObserver((mutations) => {
      if (!document.body) return;
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const element = mutation.target;
          preserveProtectedMutation(element, mutation.attributeName);
        }
      }
      scheduleScan();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-label", "role", "title"],
      childList: true,
      characterData: true,
      subtree: true,
    });
    document.addEventListener("change", (event) => {
      if (event.target instanceof Element && event.target.matches('input[name="showScores"]')) {
        scheduleScan();
      }
    }, true);
    scan();
  }

  if (location.hostname === "www.espn.co.uk" && document.readyState !== "complete") {
    window.addEventListener("load", () => {
      setTimeout(() => requestAnimationFrame(start), 2500);
    }, { once: true });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
