/* Peach State Recruits: shared UI helpers for the recruiting tools */
(function () {
  "use strict";
  const L = window.PSRLogic;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function toast(msg) { if (window.PSR && window.PSR.toast) window.PSR.toast(msg); else alert(msg); }
  function safeUrl(u) { try { if (/[\r\n]/.test(String(u || ""))) return ""; const parsed = new URL(u); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; } catch (_) { return ""; } }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

  function statusBadge(p) {
    if (p.record_status === "verified") return `<span class="rc-badge ok" title="Official links checked">Checked ${esc(L.fmtDate(p.last_checked))}</span>`;
    if (p.record_status === "needs_review") return `<span class="rc-badge warn" title="${esc(p.review_note || "")}">Needs review</span>`;
    return `<span class="rc-badge" title="Listed from a public directory. Official links not checked yet.">Listing only</span>`;
  }
  function levelBadge(level) { return `<span class="rc-badge level">${esc(level)}</span>`; }
  function demoBanner(api) {
    if (api.mode === "unavailable") return `<p class="rc-demo" role="status">${esc(api.unavailableReason)}</p>`;
    if (api.mode !== "demo") return "";
    return `<p class="rc-demo"><b>Preview mode.</b> Everything you save stays in this browser only. Use made-up details: anyone using this browser can open preview accounts. <a href="?demo=0">Use the live site</a></p>`;
  }

  // Simple sign-in block. Live: emails a sign-in link. Demo: signs in immediately.
  function renderGate(el, api, opts) {
    opts = opts || {};
    if (api.mode === "unavailable") {
      el.innerHTML = `<div class="rc-gate"><h2>Account features unavailable</h2><p>${esc(api.unavailableReason)}</p><a class="rc-btn" href="colleges.html">Browse colleges</a></div>`;
      return;
    }
    el.innerHTML = `
      <div class="rc-gate">
        <h2>${esc(opts.title || "Sign in")}</h2>
        <p class="rc-muted">${esc(api.mode === "demo" ? "Preview uses made-up accounts in this browser. No email verification or account security is provided." : (opts.text || "Free account. Your saved schools, emails and notes are private to you."))}</p>
        <form id="rcGateForm" class="rc-row" style="margin-top:14px" novalidate>
          <label class="rc-field" style="flex:1 1 240px">Email<input class="rc-input" type="email" name="email" autocomplete="email" required></label>
          <button class="rc-btn primary" type="submit" style="align-self:flex-end">${api.mode === "demo" ? "Sign in" : "Email me a sign-in link"}</button>
        </form>
        <p class="rc-small" id="rcGateMsg" role="status" style="margin-top:10px"></p>
        ${api.mode === "demo" ? `<p class="rc-small">Preview: any email works and creates a separate test account.</p>` : `<p class="rc-small">No password. We email you a link each time you sign in.</p>`}
      </div>`;
    $("#rcGateForm", el).addEventListener("submit", async e => {
      e.preventDefault();
      if (!e.target.reportValidity()) return;
      const button = $("button[type=submit]", e.target);
      if (button.disabled) return;
      button.disabled = true;
      const email = e.target.elements.namedItem("email").value;
      const msg = $("#rcGateMsg", el);
      try {
        const r = await api.signIn(email);
        if (r.emailSent) msg.textContent = "Check your email for the sign-in link. You can close this tab.";
        else if (opts.onSignedIn) opts.onSignedIn();
      } catch (err) { msg.textContent = err.message; }
      finally { button.disabled = false; }
    });
  }

  function openDialog(html, onMount) {
    const previousFocus = document.activeElement;
    const d = document.createElement("dialog");
    d.className = "rc-dialog";
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", () => { d.remove(); if (previousFocus && previousFocus.isConnected) previousFocus.focus(); });
    d.addEventListener("click", e => { const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); });
    if (onMount) onMount(d);
    d.showModal();
    return d;
  }
  function confirmDialog(text) {
    return new Promise(res => {
      const dialog = openDialog(`<div class="rc-dlg-body"><p style="margin:0">${esc(text)}</p><div class="rc-dlg-actions"><button class="rc-btn" data-v="0">Cancel</button><button class="rc-btn danger" data-v="1">Delete</button></div></div>`, d => {
        $$("button", d).forEach(b => b.addEventListener("click", () => { res(b.dataset.v === "1"); d.close(); }));
      });
      dialog.addEventListener("close", () => res(false), { once: true });
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
