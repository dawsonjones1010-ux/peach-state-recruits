/* Peach State Recruits: shared UI helpers for the recruiting tools */
(function () {
  "use strict";
  const L = window.PSRLogic;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function toast(msg) { if (window.PSR && window.PSR.toast) window.PSR.toast(msg); else alert(msg); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  function statusBadge(p) {
    if (p.record_status === "verified") return `<span class="rc-badge ok" title="Official links checked">Checked ${esc(L.fmtDate(p.last_checked))}</span>`;
    if (p.record_status === "needs_review") return `<span class="rc-badge warn" title="${esc(p.review_note || "")}">Needs review</span>`;
    return `<span class="rc-badge" title="Listed from a public directory. Official links not checked yet.">Listing only</span>`;
  }
  function levelBadge(level) { return `<span class="rc-badge level">${esc(level)}</span>`; }
  function demoBanner(api) {
    if (api.mode !== "demo") return "";
    return `<p class="rc-demo"><b>Preview mode.</b> Everything you save stays in this browser only. <a href="?demo=0">Use the live site</a></p>`;
  }

  // Simple sign-in block. Live: emails a sign-in link. Demo: signs in immediately.
  function renderGate(el, api, opts) {
    opts = opts || {};
    el.innerHTML = `
      <div class="rc-gate">
        <h2>${esc(opts.title || "Sign in")}</h2>
        <p class="rc-muted">${esc(opts.text || "Free account. Your saved schools, emails and notes are private to you.")}</p>
        <form id="rcGateForm" class="rc-row" style="margin-top:14px" novalidate>
          <label class="rc-field" style="flex:1 1 240px">Email<input class="rc-input" type="email" name="email" autocomplete="email" required></label>
          <button class="rc-btn primary" type="submit" style="align-self:flex-end">${api.mode === "demo" ? "Sign in" : "Email me a sign-in link"}</button>
        </form>
        <p class="rc-small" id="rcGateMsg" role="status" style="margin-top:10px"></p>
        ${api.mode === "demo" ? `<p class="rc-small">Preview: any email works and creates a separate test account.</p>` : `<p class="rc-small">No password. We email you a link each time you sign in.</p>`}
      </div>`;
    $("#rcGateForm", el).addEventListener("submit", async e => {
      e.preventDefault();
      const email = e.target.email.value;
      const msg = $("#rcGateMsg", el);
      try {
        const r = await api.signIn(email);
        if (r.emailSent) msg.textContent = "Check your email for the sign-in link. You can close this tab.";
        else if (opts.onSignedIn) opts.onSignedIn();
      } catch (err) { msg.textContent = err.message; }
    });
  }

  function openDialog(html, onMount) {
    const d = document.createElement("dialog");
    d.className = "rc-dialog";
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", e => { if (e.target === d) d.close(); });
    if (onMount) onMount(d);
    d.showModal();
    return d;
  }
  function confirmDialog(text) {
    return new Promise(res => {
      openDialog(`<div class="rc-dlg-body"><p style="margin:0">${esc(text)}</p><div class="rc-dlg-actions"><button class="rc-btn" data-v="0">Cancel</button><button class="rc-btn danger" data-v="1">Delete</button></div></div>`, d => {
        $$("button", d).forEach(b => b.addEventListener("click", () => { res(b.dataset.v === "1"); d.close(); }));
      });
    });
  }
  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); toast(ok || "Copied"); }
    catch (e) {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); toast(ok || "Copied"); } catch (e2) { toast("Copy failed. Select the text and copy it."); }
      t.remove();
    }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stateOptions(sel) {
    return `<option value="">Any state</option>` + L.STATE_NAMES.map(s => `<option${s === sel ? " selected" : ""}>${esc(s)}</option>`).join("");
  }
  function navInit() { if (window.PSR && window.PSR.initNav) try { window.PSR.initNav(); } catch (e) {} }

  window.PSRUI = { esc, $, $$, toast, safeUrl, host, statusBadge, levelBadge, demoBanner, renderGate, openDialog, confirmDialog, copy, download, stateOptions, navInit };
})();
