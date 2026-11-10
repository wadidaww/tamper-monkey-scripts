// ==UserScript==
// @name         GitCode PR: /approve + /lgtm button
// @namespace    https://github.com/wadidaww/tamper-monkey-scripts
// @version      1.2.0
// @description  Adds a button on GitCode pull request pages that posts a "/approve" + "/lgtm" comment in one click.
// @author       wadidaww
// @match        https://gitcode.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const COMMENT_TEXT = '/approve\n/lgtm';
  const BUTTON_ID = 'tm-approve-lgtm-btn';
  const TOAST_ID = 'tm-approve-lgtm-toast';
  const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+(\/|$)/;

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

  // ---------- Find the CodeMirror editor ----------
  // GitCode renders the comment box as a CodeMirror 6 content element.
  function findCommentEditor() {
    const selectors = [
      '.cm-content[contenteditable="true"]',
      'div.cm-content',
      '.cm-editor .cm-content',
    ];
    for (const sel of selectors) {
      const all = Array.from(document.querySelectorAll(sel)).filter(isVisible);
      if (all.length) {
        // The main comment box is usually the last visible editor on the page.
        return all[all.length - 1];
      }
    }
    return null;
  }

  // ---------- Inject text into CodeMirror ----------
  // Try multiple strategies: native CodeMirror API first, then simulated input.
  async function setEditorContent(editor, text) {
    editor.focus();
    await sleep(100);

    // Strategy 1: Access the CodeMirror view instance if exposed on the DOM node.
    const view =
      editor.cmView ||
      editor.CodeMirror ||
      (editor.closest('.cm-editor') && editor.closest('.cm-editor').cmView);

    if (view && typeof view.dispatch === 'function') {
      try {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: text,
          },
        });
        // Also try to focus the editor after dispatch.
        view.focus();
        return true;
      } catch (e) {
        console.warn('[approve-lgtm] CodeMirror dispatch failed, falling back.', e);
      }
    }

    // Strategy 2: Simulate user input via keyboard events (more compatible).
    // First, select-all and delete existing content.
    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);
    await sleep(100);

    // Then insert the text line by line.
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        // Simulate Enter key.
        editor.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          })
        );
        await sleep(50);
      }
      // Insert characters one by one.
      for (const char of lines[i]) {
        document.execCommand('insertText', false, char);
        await sleep(15);
      }
    }
    return true;
  }

  // ---------- Find the submit button ----------
  // Match common GitCode button labels.
  function findSubmitButton(editor) {
    const BUTTON_RE = /^(提交评论|发表评论|立即添加评论|添加评论|Comment|Submit|Post comment)$/i;
    let node = editor;
    // Walk up the DOM tree to find a container that holds the submit button.
    for (let i = 0; i < 25 && node; i++, node = node.parentElement) {
      const buttons = Array.from(node.querySelectorAll('button')).filter(
        (b) => b.id !== BUTTON_ID && isVisible(b)
      );
      const btn = buttons.find((b) => BUTTON_RE.test(b.textContent.trim()));
      if (btn) return btn;
    }
    return null;
  }

  function isEnabled(btn) {
    return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
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

  // ---------- Main action ----------
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
      const editor = await waitFor(findCommentEditor, 5000);
      if (!editor) {
        toast('Comment editor not found. Make sure you are on the Discussion tab.', true);
        return;
      }

      // Check existing content (CodeMirror reflects text in textContent).
      const existing = editor.textContent.trim();
      if (
        existing &&
        !existing.includes('/approve') &&
        !confirm('The comment box already has text. Replace it with /approve + /lgtm?')
      ) {
        return;
      }

      await setEditorContent(editor, COMMENT_TEXT);

      const submit = await waitFor(() => {
        const b = findSubmitButton(editor);
        return b && isEnabled(b) ? b : null;
      }, 3000);

      if (!submit) {
        toast('Text filled, but submit button not found. Please click it manually.', true);
        return;
      }

      submit.click();

      // Treat an emptied editor as success.
      const cleared = await waitFor(() => {
        const ed = findCommentEditor();
        return !ed || ed.textContent.trim() === '';
      }, 8000);

      if (cleared) {
        toast('Posted /approve and /lgtm ✔');
      } else {
        toast('Clicked submit, but could not confirm success. Please check the page.', true);
      }
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

  // ---------- Button lifecycle ----------
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

  // GitCode is an SPA: listen for route changes via popstate and DOM mutations.
  window.addEventListener('popstate', scheduleSync);
  new MutationObserver(scheduleSync).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  sync();
})();