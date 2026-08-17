// ==UserScript==
// @name GitHub Readable Diffs
// @description Makes pull-request diffs denser and easier to scan.
// @version 1.0.0
// @license MIT
// @match https://github.com/*/*/pull/*/files*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-github-readable-diffs";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .diff-table,
    .blob-code,
    .blob-code-inner {
      font-size: 13px !important;
      line-height: 1.45 !important;
    }

    .file-header {
      position: sticky !important;
      top: 0 !important;
      z-index: 5 !important;
    }
  `;
  document.head.append(style);
})();
