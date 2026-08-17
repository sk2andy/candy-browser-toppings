// ==UserScript==
// @name Google Search Cleanup
// @description Cleans tracking redirects and parameters from Google search-result links.
// @version 1.0.0
// @license MIT
// @match https://www.google.com/search*
// @match https://www.google.de/search*
// @run-at document-start
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const trackingParameters = new Set([
    "dclid",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "msclkid",
    "s_cid",
  ]);

  function removeTrackingParameters(url) {
    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key.toLowerCase())) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  function cleanResultLink(anchor) {
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.closest("#search, #rso")) return;

    anchor.removeAttribute("ping");
    anchor.removeAttribute("data-jsarwt");
    anchor.removeAttribute("data-usg");
    anchor.removeAttribute("data-ved");

    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) return;

    let url;
    try {
      url = new URL(rawHref, location.href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const isGoogleRedirect = url.origin === location.origin && url.pathname === "/url";
    if (isGoogleRedirect) {
      const targetValue = url.searchParams.get("url") ?? url.searchParams.get("q");
      if (!targetValue) return;

      try {
        const target = new URL(targetValue);
        if (target.protocol !== "http:" && target.protocol !== "https:") return;
        removeTrackingParameters(target);
        anchor.href = target.href;
      } catch {
        return;
      }
      return;
    }

    if (url.origin !== location.origin && removeTrackingParameters(url)) {
      anchor.href = url.href;
    }
  }

  function cleanTree(root) {
    if (root instanceof HTMLAnchorElement) cleanResultLink(root);
    if (!(root instanceof Element || root instanceof Document)) return;
    for (const anchor of root.querySelectorAll("#search a[href], #rso a[href]")) {
      cleanResultLink(anchor);
    }
  }

  function start() {
    cleanTree(document);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          cleanResultLink(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) cleanTree(node);
      }
    }).observe(document.documentElement, {
      attributeFilter: ["href", "ping"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  document.addEventListener("pointerdown", (event) => {
    cleanResultLink(event.target instanceof Element ? event.target.closest("a[href]") : null);
  }, true);

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
