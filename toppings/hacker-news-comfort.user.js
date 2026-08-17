// ==UserScript==
// @name Hacker News Comfort
// @description Improves typography, spacing, and tap targets on Hacker News.
// @version 1.0.0
// @license MIT
// @match https://news.ycombinator.com/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-hacker-news-comfort";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    body {
      background: #f6f6ef !important;
      font-family: system-ui, sans-serif !important;
      margin: 0 !important;
    }

    #hnmain {
      max-width: 980px !important;
      width: 100% !important;
    }

    .title,
    .comment {
      font-size: 15px !important;
      line-height: 1.55 !important;
    }

    .subtext,
    .yclinks {
      line-height: 1.8 !important;
    }
  `;
  document.head.append(style);
})();
