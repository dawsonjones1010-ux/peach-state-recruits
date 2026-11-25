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
    // Public pages show only positive badges. "Needs review" stays on the admin page.
    if (safeUrl(p.athletics_url)) return `<span class="rc-badge ok" title="Links to the school's official athletics site">Official site</span>`;
    return "";
  }
  function levelBadge(level) { return `<span class="rc-badge level">${esc(level)}</span>`; }
  function demoBanner(api) {
    if (api.mode === "unavailable") return `<p class="rc-demo" role="status">${esc(api.unavailableReason)}</p>`;
    if (api.mode !== "demo") return "";
    return `<p class="rc-demo"><b>Preview mode.</b> Everything you save stays in this browser only. Use made-up details: anyone using this browser can open preview accounts. <a href="?demo=0">Use the live site</a></p>`;
  }

  // Simple sign-in block. Live: emails a sign-in link. Demo: signs in immediately.
  // Sign in / create account. Email or username + password. opts.mode: "signin" | "create" (default "create").
  function renderGate(el, api, opts) {
    opts = opts || {};
    if (api.mode === "unavailable") {
      el.innerHTML = `<div class="rc-gate"><h2>Account features unavailable</h2><p>${esc(api.unavailableReason)}</p><a class="rc-btn" href="colleges.html">Browse colleges</a></div>`;
      return;
    }
    const demo = api.mode === "demo";
    const terms = `<label class="rc-check rc-consent"><input type="checkbox" name="consent" required> <span>I'm 13 or older. If I'm under 18, my parent or guardian knows I'm using this. I agree to the <a class="rc-link" href="terms.html" target="_blank" rel="noopener">terms</a> and <a class="rc-link" href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</span></label>`;
    const pw = (auto, label) => `<label class="rc-field"><span>${label}</span><span class="rc-pw"><input class="rc-input" type="password" name="password" autocomplete="${auto}" minlength="8" required><button class="rc-pw-show" type="button" aria-label="Show password" aria-pressed="false">Show</button></span></label>`;
    const views = {
      signin: { btn: "Sign in", body: `
          <label class="rc-field">Email or username<input class="rc-input" type="text" name="identifier" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
          ${pw("current-password", "Password")}`,
        foot: `<button class="rc-link" type="button" data-gate="forgot">Forgot password?</button>` },
      create: { btn: "Create account", body: `
          <label class="rc-field">Email<input class="rc-input" type="email" name="email" autocomplete="email" required></label>
          <label class="rc-field"><span>Username <span class="rc-muted">(optional)</span></span><input class="rc-input" type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[A-Za-z0-9_.]{3,20}" maxlength="20" aria-describedby="rcUserHint"><span class="rc-small" id="rcUserHint">3 to 20 letters, numbers, dots or underscores. Lets you sign in without typing your email.</span></label>
          ${pw("new-password", "Password <span class=\"rc-muted\">(8+ characters)</span>")}
          ${terms}`, foot: "" },
      forgot: { btn: "Email me a reset link", body: `
          <p class="rc-small" style="margin:0">Enter the email on your account and we'll send a link to set a new password.</p>
          <label class="rc-field">Email<input class="rc-input" type="email" name="email" autocomplete="email" required></label>`,
        foot: `<button class="rc-link" type="button" data-gate="signin">Back to sign in</button>` }
    };
    let mode = opts.mode === "signin" ? "signin" : "create";
    function draw(focus) {
      const v = views[mode];
      el.innerHTML = `
      <div class="rc-gate">
        <h2>${esc(opts.title || "Sign in")}</h2>
        <p class="rc-muted">${esc(demo ? "Preview uses made-up accounts in this browser. Any password works and nothing is secured." : (opts.text || "Free account. Your saved schools, emails and notes are private to you."))}</p>
        ${mode === "forgot" ? "" : `<div class="rc-gate-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected="${mode === "create"}" data-gate="create">Create account</button>
          <button type="button" role="tab" aria-selected="${mode === "signin"}" data-gate="signin">Sign in</button></div>`}
        <form id="rcGateForm" class="rc-gate-form" novalidate>
          ${v.body}
          <button class="rc-btn primary" type="submit">${v.btn}</button>
        </form>
        <p class="rc-small" id="rcGateMsg" role="status" aria-live="polite"></p>
        ${v.foot ? `<p class="rc-small rc-gate-foot">${v.foot}</p>` : ""}
      </div>`;
      $$("[data-gate]", el).forEach(b => b.addEventListener("click", () => { mode = b.dataset.gate; draw(true); }));
      $$(".rc-pw-show", el).forEach(b => b.addEventListener("click", () => {
        const i = b.previousElementSibling, show = i.type === "password";
        i.type = show ? "text" : "password"; b.textContent = show ? "Hide" : "Show"; b.setAttribute("aria-pressed", String(show)); b.setAttribute("aria-label", show ? "Hide password" : "Show password");
      }));
      if (focus) { const f = $("#rcGateForm input", el); if (f) f.focus(); }
      $("#rcGateForm", el).addEventListener("submit", async e => {
        e.preventDefault();
        const form = e.target, msg = $("#rcGateMsg", el);
        if (!form.reportValidity()) return;
        const button = $("button[type=submit]", form);
        if (button.disabled) return;
        button.disabled = true; msg.textContent = "";
        const val = n => (form.elements.namedItem(n) || {}).value || "";
        try {
          if (mode === "forgot") {
            await api.resetPassword(val("email"));
            msg.textContent = "If that email has an account, a reset link is on its way. Check your inbox and spam folder.";
            return;
          }
          const r = mode === "signin"
            ? await api.signIn({ identifier: val("identifier"), password: val("password") })
            : await api.signUp({ email: val("email"), username: val("username").trim(), password: val("password"), consent: form.elements.namedItem("consent").checked });
          if (r && r.signedIn) { if (opts.onSignedIn) opts.onSignedIn(); }
          else { mode = "signin"; draw(true); $("#rcGateMsg", el).textContent = (r && r.message) || "Account created. Sign in to continue."; }
        } catch (err) { msg.textContent = err.message; }
        finally { if (button.isConnected) button.disabled = false; }
      });
    }
    draw(false);
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
  function confirmDialog(text, options) {
    options = options || {};
    return new Promise(res => {
      const dialog = openDialog(`<div class="rc-dlg-body"><p style="margin:0">${esc(text)}</p><div class="rc-dlg-actions"><button class="rc-btn" data-v="0">Cancel</button><button class="rc-btn danger" data-v="1">${esc(options.confirmLabel || "Delete")}</button></div></div>`, d => {
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

  // "Updated every Monday" line. Shows the last weekly update's date and one count for this page when there is one.
  function updateStamp(api, el, kind) {
    if (!el) return;
    el.textContent = "Updated every Monday";
    if (!api || !api.lastUpdate) return;
    api.lastUpdate().then(u => {
      if (!u || !u.ran_on) return;
      const n = kind === "camps" ? u.camps_added : u.schools_checked;
      const what = kind === "camps" ? (n === 1 ? "new camp" : "new camps") : (n === 1 ? "school checked" : "schools checked");
      el.textContent = `Updated every Monday. Last update ${L.fmtDate(u.ran_on, { month: "short", day: "numeric" })}` + (n > 0 ? `: ${n} ${what}` : "");
    }).catch(() => {});
  }

  window.PSRUI = { esc, $, $$, toast, safeUrl, host, statusBadge, levelBadge, demoBanner, renderGate, openDialog, confirmDialog, copy, download, stateOptions, navInit, updateStamp };
})();
