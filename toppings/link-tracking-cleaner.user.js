// ==UserScript==
// @name Link Tracking Cleaner
// @description Removes known tracking parameters from outbound links on selected sites.
// @version 1.0.0
// @license MIT
// @match https://github.com/*
// @match https://medium.com/*
// @match https://news.ycombinator.com/*
// @match https://old.reddit.com/*
// @match https://www.reddit.com/*
// @run-at document-start
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const trackingParameters = new Set([
    "_hsenc",
    "_hsmi",
    "dclid",
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "mkt_tok",
    "msclkid",
    "oly_anon_id",
    "oly_enc_id",
    "rb_clickid",
    "s_cid",
    "vero_conv",
    "vero_id",
    "wickedid",
  ]);

  function isTrackingParameter(key) {
    const normalized = key.toLowerCase();
    return normalized.startsWith("utm_") || trackingParameters.has(normalized);
  }

  function cleanLink(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return;
    anchor.removeAttribute("ping");

    const rawHref = anchor.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#")) return;

    let url;
    try {
      url = new URL(rawHref, location.href);
    } catch {
      return;
    }
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin === location.origin) return;

    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
      if (isTrackingParameter(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) anchor.href = url.href;
  }

  function cleanTree(root) {
    if (root instanceof HTMLAnchorElement) cleanLink(root);
    if (!(root instanceof Element || root instanceof Document)) return;
    for (const anchor of root.querySelectorAll("a[href]")) cleanLink(anchor);
  }

  function start() {
    cleanTree(document);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          cleanLink(mutation.target);
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
    cleanLink(event.target instanceof Element ? event.target.closest("a[href]") : null);
  }, true);

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
