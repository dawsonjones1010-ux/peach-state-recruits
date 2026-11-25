/* Find My Level results: this device and the recruit's account.

   Two device slots, so one person's result never shows up in someone else's account:
   - psr_level_summary_v1       a result made while signed out (owner null). It is never uploaded on its own;
                                 a signed-in person must choose "Add to my account" (importAnon).
   - psr_level_summary_v1:acct  the signed-in account's latest result, tagged with that account's id.
                                 Shown only to that account; cleared on sign-out and on delete.
   Results made while signed in go straight to the account (public.level_results, private to the owner). */
(function () {
  "use strict";
  const KEY = "psr_level_summary_v1", ACCT = KEY + ":acct", HISTORY = "psr_fml_history_v1", HANDOFF = "psr_email_handoff_v2";
  const CFG = window.PSR_CONFIG || {};
  function client() {
    try {
      if (window.PSR_SB) return window.PSR_SB;
      const key = CFG.supabasePublishableKey || CFG.supabaseAnonKey;
      if (!window.supabase || !CFG.supabaseUrl || !key) return null;
      return (window.PSR_SB = window.supabase.createClient(CFG.supabaseUrl, key));
    } catch (_) { return null; }
  }
  const read = k => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v && v.v === 1 ? v : null; } catch (_) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const drop = k => { try { localStorage.removeItem(k); } catch (_) {} };
  const anon = () => { const s = read(KEY); return s && !s.owner ? s : null; };
  const acctFor = uid => { const s = read(ACCT); return s && uid && s.owner === uid ? s : null; };

  async function user() {
    const sb = client(); if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; } catch (_) { return null; }
  }
  async function insert(summary) {
    const sb = client(); if (!sb) return false;
    const clean = Object.assign({}, summary); delete clean.owner; delete clean.synced;
    const { error } = await sb.from("level_results").insert({ summary: clean });
    return !error;
  }
  async function latest() {
    const sb = client(), u = await user();
    if (!sb || !u) return null;
    const { data, error } = await sb.from("level_results").select("summary,created_at").order("created_at", { ascending: false }).limit(1);
    if (error || !data || !data[0]) return null;
    return Object.assign({}, data[0].summary, { owner: u.id, synced: true });
  }

  // A new result from Find My Level. Signed in: it belongs to that account. Signed out: it stays on this device.
  async function save(summary) {
    const u = await user();
    if (!u) { write(KEY, Object.assign({}, summary, { owner: null })); return false; }
    const ok = await insert(summary);
    write(ACCT, Object.assign({}, summary, { owner: u.id, synced: ok }));
    const a = anon(); if (a && a.t === summary.t) drop(KEY);   // it was this person's, made while signed in
    return ok;
  }
  // What this person should see: their account's result when signed in, the signed-out result otherwise.
  async function current() {
    const u = await user();
    if (!u) return anon();
    let mine = acctFor(u.id);
    if (mine && mine.synced === false && await insert(mine)) { mine.synced = true; write(ACCT, mine); }
    const fromAcct = await latest();
    if (fromAcct && (!mine || Date.parse(fromAcct.t) > Date.parse(mine.t))) { write(ACCT, fromAcct); mine = fromAcct; }
    if (!mine) { const other = read(ACCT); if (other && other.owner !== u.id) drop(ACCT); }
    return mine;
  }
  // A signed-out result on this device that a signed-in person could add to their account (they choose).
  async function pendingImport() { return (await user()) ? anon() : null; }
  async function importAnon() {
    const u = await user(), a = anon();
    if (!u || !a) return null;
    if (!(await insert(a))) throw new Error("Couldn't add the result to your account. Try again.");
    const mine = Object.assign({}, a, { owner: u.id, synced: true });
    write(ACCT, mine); drop(KEY);
    return mine;
  }
  function discardAnon() { drop(KEY); }
  // Sign-out: remove this account's copy from the device.
  function forgetAccount() { drop(ACCT); try { sessionStorage.removeItem(HANDOFF); } catch (_) {} }
  // Delete my data: remove this account's copy, the device history and any hand-off. Leaves a signed-out
  // result alone only if it isn't this person's (they can remove it with discardAnon).
  function clearDevice(alsoAnon) {
    drop(ACCT); drop(HISTORY);
    if (alsoAnon) drop(KEY);
    try { sessionStorage.removeItem(HANDOFF); sessionStorage.removeItem("psr_pw_recovery"); } catch (_) {}
  }
  // Backward compatible name used by older pages.
  const sync = current;
  window.PSRLevelSync = { KEY, ACCT, user, save, current, sync, latest, pendingImport, importAnon, discardAnon, forgetAccount, clearDevice, anon, local: anon, signedIn: async () => !!(await user()) };
})();
