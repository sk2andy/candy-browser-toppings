// ==UserScript==
// @name Wikipedia Reading Focus
// @description Centers Wikipedia articles at a comfortable reading width.
// @version 1.0.0
// @license MIT
// @match https://*.wikipedia.org/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-wikipedia-reading-focus";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .mw-body-content {
      font-size: 1.05rem !important;
      line-height: 1.7 !important;
    }

    .mw-body-content > :is(p, ul, ol, dl, blockquote) {
      max-width: 75ch !important;
    }

    .mw-parser-output > :is(p, ul, ol, dl, blockquote) {
      max-width: 75ch !important;
    }
  `;
  document.head.append(style);
})();
