// ==UserScript==
// @name YouTube No Shorts
// @description Opens Shorts in the regular YouTube video player.
// @version 1.0.0
// @license MIT
// @match https://www.youtube.com/shorts/*
// @run-at document-start
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const match = location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})\/?$/);
  if (!match) return;

  const target = new URL("/watch", location.origin);
  target.searchParams.set("v", match[1]);
  location.replace(target.href);
})();
