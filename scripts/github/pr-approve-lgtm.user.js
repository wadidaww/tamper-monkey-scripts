// ==UserScript==
// @name         GitHub PR: /approve + /lgtm button
// @namespace    https://github.com/wadidaww/tamper-monkey-scripts
// @version      1.0.0
// @description  Adds a button on GitHub pull request pages that posts a "/approve" + "/lgtm" comment in one click.
// @author       wadidaww
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/wadidaww/tamper-monkey-scripts/main/scripts/github/pr-approve-lgtm.user.js
// @downloadURL  https://raw.githubusercontent.com/wadidaww/tamper-monkey-scripts/main/scripts/github/pr-approve-lgtm.user.js
// ==/UserScript==

(function () {
  'use strict';

  const COMMENT_TEXT = '/approve\n/lgtm';
  const BUTTON_ID = 'tm-approve-lgtm-btn';
  const TOAST_ID = 'tm-approve-lgtm-toast';
  // Matches /owner/repo/pull/123 and its sub-tabs (/commits, /files, ...).
  const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+(\/|$)/;

  // ---------- helpers ----------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeoutMs = 5000, stepMs = 100) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(stepMs);
    }
    return null;
  }

  function isVisible(el) {
    return !!(el && el.offsetParent !== null && el.getClientRects().length);
  }

  // The "Add a comment" box at the bottom of the Conversation tab.
  // Covers both the newer React UI and the classic Rails form.
  function findCommentTextarea() {
    const selectors = [
      'textarea[placeholder="Add your comment here..."]',
      'textarea[placeholder="Add your comment here…"]',
      'textarea#new_comment_field',
      'form.js-new-comment-form textarea[name="comment[body]"]',
    ];
    for (const sel of selectors) {
      const all = Array.from(document.querySelectorAll(sel)).filter(isVisible);
      // The main box is the last one on the page (inline review boxes come earlier).
      if (all.length) return all[all.length - 1];
    }
    return null;
  }

  function isEnabled(btn) {
    return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
  }

  // Walk up from the textarea and find the nearest button labelled exactly "Comment".
  function findCommentButton(textarea) {
    let node = textarea;
    for (let i = 0; i < 15 && node; i++, node = node.parentElement) {
      const btn = Array.from(node.querySelectorAll('button')).find(
        (b) => b.id !== BUTTON_ID && b.textContent.trim() === 'Comment' && isVisible(b)
      );
      if (btn) return btn;
    }
    return null;
  }

  // React keeps its own copy of the value, so set it through the native setter
  // and fire an input event so the component (and the Comment button) see it.
  function setTextareaValue(textarea, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    textarea.focus();
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function toast(msg, isError = false) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      Object.assign(el.style, {
        position: 'fixed',
        right: '24px',
        bottom: '72px',
        zIndex: 2147483647,
        padding: '8px 12px',
        borderRadius: '6px',
        font: '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff',
        boxShadow: '0 4px 12px rgba(0,0,0,.25)',
        maxWidth: '320px',
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = isError ? '#cf222e' : '#1f883d';
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = 'none'), 4000);
  }

  // ---------- main action ----------

  let busy = false;

  async function postApproveLgtm() {
    if (busy) return;
    busy = true;
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Posting…';
    }
    try {
      const textarea = await waitFor(findCommentTextarea, 3000);
      if (!textarea) {
        toast('Comment box not found. Open the Conversation tab and try again.', true);
        return;
      }

      const existing = textarea.value.trim();
      if (existing && existing !== COMMENT_TEXT &&
          !confirm('The comment box already has text. Replace it with /approve + /lgtm and post?')) {
        return;
      }

      setTextareaValue(textarea, COMMENT_TEXT);

      const submit = await waitFor(() => {
        const b = findCommentButton(textarea);
        return b && isEnabled(b) ? b : null;
      }, 3000);
      if (!submit) {
        toast('Filled the comment box, but could not find the Comment button. Please click it yourself.', true);
        return;
      }

      submit.click();

      // Treat an emptied textarea as success.
      const cleared = await waitFor(() => {
        const ta = findCommentTextarea();
        return !ta || ta.value.trim() === '';
      }, 8000);
      if (cleared) toast('Posted /approve and /lgtm ✔');
      else toast('Clicked Comment, but the post could not be confirmed. Please check the page.', true);
    } catch (e) {
      console.error('[approve-lgtm]', e);
      toast('Something went wrong: ' + e.message, true);
    } finally {
      busy = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✔ /approve + /lgtm';
      }
    }
  }

  // ---------- button lifecycle ----------

  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = '✔ /approve + /lgtm';
    btn.title = 'Post a comment with /approve and /lgtm';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: 2147483647,
      padding: '8px 14px',
      border: '1px solid rgba(31,35,40,.15)',
      borderRadius: '6px',
      background: '#1f883d',
      color: '#fff',
      font: '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,.2)',
    });
    btn.addEventListener('click', postApproveLgtm);
    return btn;
  }

  // GitHub navigates without full page loads, so re-check whenever the URL
  // or DOM changes and add/remove the button to match.
  function sync() {
    const onPr = PR_PATH.test(location.pathname);
    const existing = document.getElementById(BUTTON_ID);
    if (onPr && !existing && document.body) {
      document.body.appendChild(createButton());
    } else if (!onPr && existing) {
      existing.remove();
    }
  }

  let scheduled = false;
  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  ['turbo:load', 'turbo:render', 'pjax:end', 'popstate'].forEach((evt) =>
    window.addEventListener(evt, scheduleSync)
  );
  document.addEventListener('turbo:load', scheduleSync);
  new MutationObserver(scheduleSync).observe(document.documentElement, { childList: true, subtree: true });
  sync();
})();
