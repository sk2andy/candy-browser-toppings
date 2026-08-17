// ==UserScript==
// @name Hacker News Comfort
// @description Adds readable cards, larger type, and stronger tap targets to Hacker News.
// @version 1.1.0
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
    :root {
      color-scheme: light dark;
    }

    body {
      background: #eef1f5 !important;
      color: #1f2937 !important;
      font-family: system-ui, sans-serif !important;
      margin: 0 !important;
    }

    #hnmain {
      background: #eef1f5 !important;
      max-width: 980px !important;
      width: 100% !important;
    }

    #hnmain > tbody > tr:first-child > td {
      background: #ff6600 !important;
      box-shadow: 0 3px 14px rgb(0 0 0 / 18%) !important;
      padding: 10px 12px !important;
      position: sticky !important;
      top: 0 !important;
      z-index: 10 !important;
    }

    .pagetop {
      display: inline-block !important;
      font-size: 14px !important;
      line-height: 1.55 !important;
    }

    .pagetop a {
      display: inline-block !important;
      padding: 4px 3px !important;
    }

    .athing:not(.comtr) > td,
    .athing:not(.comtr) + tr > td {
      background: #ffffff !important;
    }

    .athing:not(.comtr) > td {
      padding-top: 13px !important;
    }

    .athing:not(.comtr) > td:first-child {
      border-radius: 12px 0 0 !important;
      padding-left: 10px !important;
    }

    .athing:not(.comtr) > td:last-child {
      border-radius: 0 12px 0 0 !important;
      padding-right: 12px !important;
    }

    .athing:not(.comtr) + tr > td {
      padding-bottom: 12px !important;
    }

    .athing:not(.comtr) + tr > td:first-child {
      border-radius: 0 0 0 12px !important;
    }

    .athing:not(.comtr) + tr > td:last-child {
      border-radius: 0 0 12px !important;
      padding-right: 12px !important;
    }

    .athing .title,
    .comment {
      font-size: 17px !important;
      line-height: 1.5 !important;
    }

    .titleline > a {
      color: #111827 !important;
      font-weight: 650 !important;
      text-decoration: none !important;
    }

    .titleline > a:visited {
      color: #6b4e8a !important;
    }

    .subtext,
    .yclinks {
      font-size: 13px !important;
      line-height: 1.75 !important;
    }

    .subtext a,
    .yclinks a,
    .sitebit a {
      color: #475467 !important;
      display: inline-block !important;
      padding-block: 3px !important;
    }

    .commtext,
    .commtext span {
      color: #344054 !important;
    }

    .commtext a {
      color: #175cd3 !important;
    }

    .comtr > td {
      border-bottom: 1px solid #e4e7ec !important;
      padding-block: 10px !important;
    }

    .rank,
    .sitebit,
    .subtext,
    .yclinks {
      color: #667085 !important;
    }

    .spacer {
      height: 12px !important;
    }

    .morelink {
      display: inline-block !important;
      font-size: 16px !important;
      font-weight: 700 !important;
      padding: 10px 4px !important;
    }

    @media (max-width: 680px) {
      #hnmain > tbody > tr:nth-child(3) > td {
        padding: 12px 8px !important;
      }

      .athing .title,
      .comment {
        font-size: 17px !important;
      }

      .athing:not(.comtr) > td:last-child,
      .athing:not(.comtr) + tr > td:last-child {
        padding-right: 10px !important;
      }
    }

    @media (prefers-color-scheme: dark) {
      body {
        background: #101318 !important;
        color: #e5e7eb !important;
      }

      #hnmain {
        background: #101318 !important;
      }

      .athing:not(.comtr) > td,
      .athing:not(.comtr) + tr > td {
        background: #1b2028 !important;
      }

      .titleline > a {
        color: #f3f4f6 !important;
      }

      .titleline > a:visited {
        color: #c4b5fd !important;
      }

      .rank,
      .sitebit,
      .subtext,
      .yclinks {
        color: #aeb7c5 !important;
      }

      .subtext a,
      .yclinks a,
      .sitebit a {
        color: #cbd5e1 !important;
      }

      .commtext,
      .commtext span {
        color: #d1d5db !important;
      }

      .commtext a {
        color: #93c5fd !important;
      }

      .comtr > td {
        border-bottom-color: #344054 !important;
      }
    }
  `;
  document.head.append(style);
})();
