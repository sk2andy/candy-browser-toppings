// ==UserScript==
// @name Stack Overflow Focus
// @description Hides sidebars on question pages to leave more room for answers.
// @version 1.0.0
// @license MIT
// @match https://stackoverflow.com/questions/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-stack-overflow-focus";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #left-sidebar,
    #sidebar {
      display: none !important;
    }

    #mainbar,
    .mainbar {
      float: none !important;
      width: min(100%, 900px) !important;
    }

    #content {
      margin-left: auto !important;
      margin-right: auto !important;
      max-width: 980px !important;
    }
  `;
  document.head.append(style);
})();
