// ==UserScript==
// @name Medium Reading Focus
// @description Removes sticky app and sign-up chrome from Medium articles without touching paywalls.
// @version 1.0.0
// @license MIT
// @match https://medium.com/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const marker = "data-candy-medium-reading-focus";
  const styleId = "candy-topping-medium-reading-focus";
  const appLinkSelector =
    'a[href*="play.google.com/store/apps/details?id=com.medium.reader"]';
  const actionLabel = /clap|responses?|repost|bookmark/i;
  let scheduled = false;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    [${marker}] {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).append(style);

  const clearMarkers = () => {
    document.querySelectorAll(`[${marker}]`).forEach((element) => {
      element.removeAttribute(marker);
    });
  };

  const markPositionedAncestor = (element, edge) => {
    for (let candidate = element; candidate && candidate !== document.body; candidate = candidate.parentElement) {
      const position = getComputedStyle(candidate).position;
      const rect = candidate.getBoundingClientRect();
      const touchesEdge = edge === "top"
        ? rect.top <= 8
        : Math.abs(innerHeight - rect.bottom) <= 8;
      if (
        (position === "fixed" || position === "sticky")
        && touchesEdge
        && rect.width >= innerWidth * 0.6
        && rect.height > 0
        && rect.height <= 180
      ) {
        candidate.setAttribute(marker, "chrome");
        return candidate;
      }
    }
    return null;
  };

  const markHeader = () => {
    const signUp = document.querySelector('[data-testid="headerSignUpButton"]');
    const signIn = document.querySelector('[data-testid="headerSignInButton"]');
    const appLink = document.querySelector(appLinkSelector);
    const anchor = appLink || (signUp && signIn ? signUp : null);
    if (anchor) markPositionedAncestor(anchor, "top");
  };

  const markNewsletterCard = (article) => {
    article.querySelectorAll('input[placeholder="Enter your email"]').forEach((emailInput) => {
      for (
        let candidate = emailInput.parentElement;
        candidate && candidate !== article;
        candidate = candidate.parentElement
      ) {
        const hasSubscribeButton = [...candidate.querySelectorAll("button")]
          .some((button) => /^subscribe$/i.test(button.textContent.trim()));
        const hasRememberControl = [...candidate.querySelectorAll('input, [role="checkbox"]')]
          .some((control) => /remember me/i.test(
            control.getAttribute("aria-label")
              || control.parentElement?.textContent
              || control.parentElement?.parentElement?.textContent
              || "",
          ));
        if (hasSubscribeButton && hasRememberControl) {
          candidate.setAttribute(marker, "newsletter");
          break;
        }
      }
    });
  };

  const markBottomActions = () => {
    const controls = [...document.querySelectorAll('[aria-label]')]
      .filter((element) => actionLabel.test(element.getAttribute("aria-label") || ""));
    for (const control of controls) {
      for (
        let candidate = control.parentElement, depth = 0;
        candidate && candidate !== document.body && depth < 7;
        candidate = candidate.parentElement, depth += 1
      ) {
        const position = getComputedStyle(candidate).position;
        if (position !== "fixed" && position !== "sticky") continue;
        const matchingControls = [...candidate.querySelectorAll('[aria-label]')]
          .filter((element) => actionLabel.test(element.getAttribute("aria-label") || ""));
        if (matchingControls.length >= 3 && markPositionedAncestor(candidate, "bottom")) return;
      }
    }
  };

  const apply = () => {
    scheduled = false;
    clearMarkers();
    const article = [...document.querySelectorAll("article")]
      .find((candidate) => candidate.querySelector("h1"));
    if (!article) return;
    markHeader();
    markNewsletterCard(article);
    markBottomActions();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  };

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
