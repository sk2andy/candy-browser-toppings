// ==UserScript==
// @name Copy Code Button
// @description Adds accessible copy buttons to code blocks that do not already have one.
// @version 1.0.0
// @license MIT
// @match https://developer.android.com/*
// @match https://developer.mozilla.org/*
// @match https://docs.github.com/*
// @match https://docs.gradle.org/*
// @run-at document-end
// @grant none
// ==/UserScript==

(() => {
  "use strict";

  const styleId = "candy-topping-copy-code-button";
  const buttonClass = "candy-copy-code-button";
  const handledAttribute = "data-candy-copy-code";
  const copyWords = /\b(copy|clipboard|kopieren|copier|copiar|copia)\b/i;

  function buttonDescription(button) {
    return [
      button.textContent,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
      button.className,
      button.getAttribute("data-testid"),
    ].filter(Boolean).join(" ");
  }

  function hasCopyButton(pre) {
    const vicinity = pre.parentElement;
    if (!vicinity) return false;
    const codeBlocks = [...vicinity.querySelectorAll("pre")];
    return Array.from(vicinity.querySelectorAll("button, [role='button']"))
      .some((button) => {
        if (!copyWords.test(buttonDescription(button))) return false;
        if (codeBlocks.length <= 1) return true;
        const buttonTop = button.getBoundingClientRect().top;
        const nearestBlock = codeBlocks.reduce((nearest, block) => (
          Math.abs(block.getBoundingClientRect().top - buttonTop)
            < Math.abs(nearest.getBoundingClientRect().top - buttonTop)
            ? block
            : nearest
        ));
        return nearestBlock === pre;
      });
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.cssText = "position:fixed;inset:0;opacity:0;pointer-events:none";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copyCode(pre) {
    const text = (pre.querySelector("code") ?? pre).innerText;
    if (!text) return false;

    try {
      if (!navigator.clipboard?.writeText) return fallbackCopy(text);
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return fallbackCopy(text);
    }
  }

  function showResult(button, copied) {
    const label = copied ? "Copied" : "Copy failed";
    button.textContent = label;
    button.setAttribute("aria-label", label);
    window.setTimeout(() => {
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code");
    }, 1600);
  }

  function enhance(pre) {
    if (!(pre instanceof HTMLPreElement) || pre.hasAttribute(handledAttribute)) return;
    if (pre.closest(".CodeMirror, [contenteditable='true']") || pre.querySelector("textarea, input")) return;
    if (!pre.textContent?.trim() || hasCopyButton(pre)) {
      pre.setAttribute(handledAttribute, "existing");
      return;
    }

    pre.setAttribute(handledAttribute, "added");
    const button = document.createElement("button");
    button.type = "button";
    button.className = buttonClass;
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code");
    button.addEventListener("click", async () => {
      button.disabled = true;
      const copied = await copyCode(pre);
      button.disabled = false;
      showResult(button, copied);
    });
    pre.before(button);
  }

  function enhanceTree(root) {
    if (root instanceof HTMLPreElement) enhance(root);
    if (!(root instanceof Element || root instanceof Document)) return;
    for (const pre of root.querySelectorAll("pre")) enhance(pre);
  }

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .${buttonClass} {
        appearance: none;
        background: Canvas;
        border: 1px solid GrayText;
        border-radius: 8px;
        color: CanvasText;
        cursor: pointer;
        display: block;
        font: 600 13px/1 system-ui, sans-serif;
        margin: 6px 6px -42px auto;
        min-height: 36px;
        padding: 0 12px;
        position: relative;
        z-index: 2;
      }

      .${buttonClass}:focus-visible {
        outline: 3px solid Highlight;
        outline-offset: 2px;
      }

      .${buttonClass}:disabled {
        cursor: wait;
        opacity: 0.65;
      }

      .${buttonClass} + pre {
        padding-top: 48px !important;
      }
    `;
    document.head.append(style);
  }

  enhanceTree(document);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) enhanceTree(node);
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
