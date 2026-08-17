// ==UserScript==
// @name Reddit Thread Comfort
// @description Hides Reddit app prompts and makes mobile comment threads easier to read.
// @version 1.0.0
// @license MIT
// @match https://www.reddit.com/*
// @match https://reddit.com/*
// @run-at document-start
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-reddit-thread-comfort";
  const exactPromoSelector = [
    "#app-upsell-blocking-bottom-sheet-direct",
    "#app-upsell-blocking-bottom-sheet-seo",
    "#xpromo-bottom-sheet",
    "#xpromo-new-app-selector",
    "#xpromo-small-header",
    "#open-app-header-cta",
    "xpromo-app-selector",
    "xpromo-bottom-sheet",
    '[bundlename="app_selector"]',
    'a[id^="open-app-"][href*="reddit.onelink.me"]',
  ].join(", ");
  const configuredPromoSelector = [
    ".configured-xpromo",
    ".configured-xpromo-bottom-sheet",
    ".configured-xpromo-full-screen",
  ].join(", ");
  const headerPromoSelector = [
    "#xpromo-small-header",
    "#open-app-header-cta",
    'a[id^="open-app-"][href*="reddit.onelink.me"]',
  ].join(", ");
  const promoText = /get the app|view in (?:the )?reddit app|continue in app|see reddit in/i;
  const excludedText = /nsfw|mature content|age|auth|log\s?in|consent|cookie|protected community/i;
  const modalSelector = [
    '[aria-modal="true"]',
    '[role="dialog"]',
    "auth-flow-manager",
    "protected-community-modal",
    "rpl-bottom-sheet",
    "rpl-modal-card",
  ].join(", ");
  const observedRoots = new WeakSet();
  const pendingRoots = new Set();
  let scheduled = false;
  let unlockTimer = 0;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    ${headerPromoSelector} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    @media (max-width: 640px) {
      shreddit-comment [slot="comment"] {
        font-size: 16px !important;
        line-height: 24px !important;
      }

      shreddit-comment [slot="commentMeta"] {
        font-size: 13px !important;
        line-height: 18px !important;
      }

      shreddit-comment[depth="0"] {
        border-block-start: 1px solid var(--color-neutral-border-weak, rgb(128 128 128 / 30%));
        padding-block: 8px !important;
      }

      shreddit-comment-action-row button {
        min-height: 40px !important;
        min-width: 40px !important;
      }

      shreddit-comment [slot="actionRow"],
      shreddit-comment [slot="more-comments-permalink"],
      .more-comments-link {
        align-items: center !important;
        min-height: 44px !important;
      }
    }

    html[data-candy-reddit-scroll-unlocked],
    html[data-candy-reddit-scroll-unlocked] body {
      overflow-y: auto !important;
      pointer-events: auto !important;
      touch-action: auto !important;
    }
  `;
  (document.head || document.documentElement).append(style);

  const restorePageScroll = (scrollPosition) => {
    for (const root of [document.documentElement, document.body]) {
      if (!root) continue;
      if (root.style.overflow === "hidden" || root.style.overflow === "clip") {
        root.style.removeProperty("overflow");
      }
      if (root.style.overflowY === "hidden" || root.style.overflowY === "clip") {
        root.style.removeProperty("overflow-y");
      }
      if (root.style.position === "fixed") root.style.removeProperty("position");
      if (root.style.top.startsWith("-")) root.style.removeProperty("top");
      root.classList.remove(
        "m-scroll-lock",
        "no-scroll",
        "overflow-hidden",
        "rpl-scroll-lock",
        "scroll-disabled",
        "scroll-is-blocked",
      );
    }
    document.documentElement.setAttribute("data-candy-reddit-scroll-unlocked", "");
    window.scrollTo(0, scrollPosition);
    clearTimeout(unlockTimer);
    unlockTimer = window.setTimeout(() => {
      document.documentElement.removeAttribute("data-candy-reddit-scroll-unlocked");
    }, 4000);
  };

  const shadowIncludingElements = (root) => {
    const elements = [...root.querySelectorAll("*")];
    for (const element of elements) {
      if (element.shadowRoot) observeRoot(element.shadowRoot);
    }
    return elements;
  };

  const hasAppDestination = (element) => {
    if (
      element instanceof Element
      && element.matches('a[href*="reddit.onelink.me"], a[href*="play.google.com/store/apps"]')
    ) {
      return true;
    }
    if (element.querySelector('a[href*="reddit.onelink.me"], a[href*="play.google.com/store/apps"]')) {
      return true;
    }
    return shadowIncludingElements(element).some((descendant) => (
      descendant.shadowRoot
      && hasAppDestination(descendant.shadowRoot)
    ));
  };

  const removePromos = (root = document) => {
    const roots = [root];
    for (let index = 0; index < roots.length; index += 1) {
      if (roots[index] instanceof Element && roots[index].shadowRoot) {
        observeRoot(roots[index].shadowRoot);
        roots.push(roots[index].shadowRoot);
      }
      shadowIncludingElements(roots[index]).forEach((element) => {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      });
    }
    const candidates = new Set();
    for (const currentRoot of roots) {
      if (currentRoot instanceof Element && currentRoot.matches(exactPromoSelector)) {
        candidates.add(currentRoot);
      }
      currentRoot.querySelectorAll(exactPromoSelector).forEach((candidate) => candidates.add(candidate));
      if (currentRoot instanceof Element && currentRoot.matches(configuredPromoSelector)) {
        const text = currentRoot.textContent || "";
        if (promoText.test(text) && hasAppDestination(currentRoot)) candidates.add(currentRoot);
      }
      currentRoot.querySelectorAll(configuredPromoSelector).forEach((candidate) => {
        const text = candidate.textContent || "";
        if (promoText.test(text) && hasAppDestination(candidate)) candidates.add(candidate);
      });
    }
    const safeCandidates = [...candidates].filter((candidate) => {
      const identity = `${candidate.id} ${candidate.className} ${candidate.textContent || ""}`;
      return !excludedText.test(identity);
    });
    if (safeCandidates.length === 0) return;
    const bodyTop = Number.parseFloat(document.body?.style.top || "0");
    const scrollPosition = window.scrollY || (bodyTop < 0 ? -bodyTop : 0);
    safeCandidates.forEach((promo) => promo.remove());
    const pageRoots = [document];
    for (let index = 0; index < pageRoots.length; index += 1) {
      shadowIncludingElements(pageRoots[index]).forEach((element) => {
        if (element.shadowRoot) pageRoots.push(element.shadowRoot);
      });
    }
    const hasVisibleModal = pageRoots.some((currentRoot) => (
      [...currentRoot.querySelectorAll(modalSelector)].some((element) => {
        if (!element.isConnected) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && rect.width > 0
          && rect.height > 0;
      })
    ));
    if (!hasVisibleModal) restorePageScroll(scrollPosition);
  };

  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          schedule(mutation.target);
          continue;
        }
        if (mutation.addedNodes.length === 0) continue;
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element || node instanceof DocumentFragment) schedule(node);
          else schedule(mutation.target);
        });
      }
    }).observe(root, {
      attributeFilter: ["bundlename", "class", "id"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    schedule(root);
  }

  const schedule = (root = document) => {
    pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      roots.forEach((pendingRoot) => removePromos(pendingRoot));
    });
  };

  observeRoot(document);
})();
