/* Find My Level results in the recruit's account.
   The latest result is always kept on this device (psr_level_summary_v1). When the person is signed in,
   each new result is also saved to public.level_results (private to them), and a result made while
   signed out is uploaded the next time a page with this file sees them signed in. */
(function () {
  "use strict";
  const KEY = "psr_level_summary_v1";
  const CFG = window.PSR_CONFIG || {};
  function client() {
    try {
      if (window.PSR_SB) return window.PSR_SB;
      const key = CFG.supabasePublishableKey || CFG.supabaseAnonKey;
      if (!window.supabase || !CFG.supabaseUrl || !key) return null;
      return (window.PSR_SB = window.supabase.createClient(CFG.supabaseUrl, key));
    } catch (_) { return null; }
  }
  function local() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.v === 1 ? v : null; } catch (_) { return null; } }
  function setLocal(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} }
  async function user() {
    const sb = client(); if (!sb) return null;
    try { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; } catch (_) { return null; }
  }
  async function save(summary) {
    const sb = client(), u = await user();
    if (!sb || !u || !summary) return false;
    const { error } = await sb.from("level_results").insert({ summary });
    if (error) return false;
    const cur = local();
    if (cur && cur.t === summary.t) setLocal(Object.assign(cur, { synced: u.id }));
    return true;
  }
  async function latest() {
    const sb = client(), u = await user();
    if (!sb || !u) return null;
    const { data, error } = await sb.from("level_results").select("summary,created_at").order("created_at", { ascending: false }).limit(1);
    if (error || !data || !data[0]) return null;
    return data[0].summary;
  }
  // Upload a result made while signed out (or on a failed save), then make sure this device has the newest one.
  async function sync() {
    const u = await user(); if (!u) return local();
    const cur = local();
    if (cur && cur.synced !== u.id) await save(cur);
    const acct = await latest();
    const now = local();
    if (acct && (!now || Date.parse(acct.t) > Date.parse(now.t))) { setLocal(Object.assign({}, acct, { synced: u.id })); return local(); }
    return now;
  }
  window.PSRLevelSync = { KEY, local, user, save, latest, sync, signedIn: async () => !!(await user()) };
})();
