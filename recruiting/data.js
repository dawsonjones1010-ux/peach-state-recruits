/*
  Peach State Recruits: recruiting tools data layer.
  window.PSRData.init() picks a backend:
    - "live":  Supabase (config.js keys). Private rows are protected by row level security.
    - "demo":  this browser only (localStorage). Used for previews (?demo=1) and UI tests.
  Both backends expose the same async methods, so the pages never branch on the backend.
*/
(function () {
  "use strict";
  const L = window.PSRLogic;
  const CFG = window.PSR_CONFIG || {};
  const PROGRAM_COLS = "id,slug,name,level,association,conference,city,state,website_url,athletics_url,roster_url,schedule_url,camps_url,questionnaire_url,staff_url,majors_url,undergrad_enrollment,admission_rate,sat_25,sat_75,act_25,act_75,grad_rate,tuition_in_state,tuition_out_state,avg_net_price,academic_year,academic_source_url,listing_source,listing_source_url,record_status,last_checked,review_note,updated_at";

  let fallbackCache = null;
  async function loadFallback() {
    if (fallbackCache) return fallbackCache;
    const [dir, seed] = await Promise.all([
      fetch("data/programs.json", { cache: "no-cache" }).then(r => r.json()),
      fetch("data/recruiting-seed.json", { cache: "no-cache" }).then(r => r.json())
    ]);
    const programs = dir.programs.map(p => Object.assign({ id: "p_" + p.slug, listing_source: (dir.sources[p.level] || {}).name, listing_source_url: (dir.sources[p.level] || {}).url }, p));
    const bySlug = new Map(programs.map(p => [p.slug, p]));
    const camps = seed.camps.map(c => Object.assign({}, c, { program_id: bySlug.get(c.program_slug) ? bySlug.get(c.program_slug).id : null }));
    fallbackCache = { programs, rules: seed.rules.map((r, i) => Object.assign({ id: "r" + i }, r)), camps };
    return fallbackCache;
  }
  function attachLevels(camps, programs) {
    const byId = new Map(programs.map(p => [p.id, p]));
    return camps.map(c => { const p = byId.get(c.program_id); return Object.assign({}, c, { level: p ? p.level : null, conference: p ? p.conference : null, band: p ? L.bandOf(p) : null, program_name: p ? p.name : null, program_slug: p ? p.slug : null }); });
  }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2)); }

  // =================================================================== DEMO backend
  function DemoBackend() {
    const KEY = "psr_demo_v1";
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { session: null, users: {}, admin: {} }; } catch (e) { return { session: null, users: {}, admin: {} }; } };
    const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { throw new Error("This browser could not save the preview. Storage may be blocked or full."); } };
    let listeners = [];
    const me = () => { const s = read(); return s.session ? { id: s.session, email: s.users[s.session] && s.users[s.session].email } : null; };
    function bucket(name) {
      const s = read(); const u = s.session; if (!u) throw new Error("Sign in first.");
      return { s, u, rows: (s.users[u][name] = s.users[u][name] || []) };
    }
    function crud(name) {
      return {
        list: async () => { const u = me(); if (!u) return []; return JSON.parse(JSON.stringify(read().users[u.id][name] || [])); },
        insert: async row => { const { s, u, rows } = bucket(name); const r = Object.assign({ id: uid(), user_id: u, created_at: new Date().toISOString() }, row, { updated_at: new Date().toISOString() }); rows.push(r); write(s); return r; },
        update: async (id, patch) => { const { s, rows } = bucket(name); const r = rows.find(x => x.id === id); if (!r) throw new Error("Not found"); Object.assign(r, patch, { updated_at: new Date().toISOString() }); write(s); return r; },
        remove: async id => { const { s, u } = bucket(name); s.users[u][name] = s.users[u][name].filter(x => x.id !== id); write(s); }
      };
    }
    const tables = {};
    ["saved_schools", "email_drafts", "communications", "plan_tasks", "saved_camps"].forEach(t => tables[t] = crud(t));
    const adminEdits = () => read().admin;
    async function directory() {
      const fb = await loadFallback();
      const a = adminEdits();
      const programs = fb.programs.map(p => Object.assign({}, p, (a.programs || {})[p.id] || {})).concat((a.newPrograms || []));
      const camps = fb.camps.map(c => Object.assign({}, c, (a.camps || {})[c.id] || {})).filter(c => !(a.deletedCamps || []).includes(c.id)).concat(a.newCamps || []);
      const rules = fb.rules.map(r => Object.assign({}, r, (a.rules || {})[r.id] || {})).concat(a.newRules || []);
      return { programs, camps, rules };
    }
    return {
      mode: "demo",
      async getUser() { return me(); },
      onAuth(cb) { listeners.push(cb); },
      async signIn(email) {
        email = String(email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
        const s = read(); let id = Object.keys(s.users).find(k => s.users[k].email === email);
        if (!id) { id = uid(); s.users[id] = { email }; }
        s.session = id; write(s); listeners.forEach(f => f()); return { signedIn: true };
      },
      async signOut() { const s = read(); s.session = null; write(s); listeners.forEach(f => f()); },
      async isAdmin() { const u = me(); return !!(u && /^admin@/.test(u.email || "")); },
      async listPrograms() { return (await directory()).programs.filter(p => p.record_status !== "hidden" || false); },
      async listProgramsAdmin() { return (await directory()).programs; },
      async listRules() { return (await directory()).rules; },
      async listCamps() { const d = await directory(); return attachLevels(d.camps, d.programs); },
      async listSavedCamps(ids) { const d = await directory(); return attachLevels(d.camps.filter(c => ids.includes(c.id) && c.record_status !== "hidden"), d.programs); },
      async getProfile() { const u = me(); if (!u) return null; return read().users[u.id].profile || { user_id: u.id, contact_email: u.email, metrics: {}, prep: {}, levels_of_interest: [], regions: [] }; },
      async saveProfile(p) { const { s, u } = bucket("_"); s.users[u].profile = Object.assign({}, s.users[u].profile || {}, p, { user_id: u, updated_at: new Date().toISOString() }); write(s); return s.users[u].profile; },
      async deleteMyData() { const s = read(); const u = s.session; if (!u) throw new Error("Sign in first."); const email = s.users[u] && s.users[u].email; s.users[u] = { email }; write(s); },
      async logEmailSent(draftId, occurredOn, followUpOn, coachName) {
        const { s, u } = bucket("email_drafts"); const owner = s.users[u];
        const draft = (owner.email_drafts || []).find(d => d.id === draftId);
        if (!draft || !draft.program_id) throw new Error("Draft not found or no school selected");
        if (!L.parseISO(occurredOn) || occurredOn > L.toISO(new Date()) || (followUpOn && (!L.parseISO(followUpOn) || followUpOn < occurredOn))) throw new Error("Check the sent and follow-up dates");
        owner.communications = owner.communications || [];
        let communication = owner.communications.find(c => c.draft_id === draftId && c.direction === "sent");
        if (!communication) { communication = { id: uid(), user_id: u, program_id: draft.program_id, draft_id: draft.id, direction: "sent", kind: draft.kind, channel: "email", coach_name: coachName || null, subject: draft.subject, occurred_on: occurredOn, follow_up_on: followUpOn || null, created_at: new Date().toISOString() }; owner.communications.push(communication); }
        draft.status = "sent";
        const school = (owner.saved_schools || []).find(x => x.program_id === draft.program_id);
        if (school) { if (school.stage === "researching") school.stage = "contacted"; if (!school.coach_name) school.coach_name = coachName || null; }
        write(s); return { draft, communication };
      },
      table: name => tables[name],
      // admin (demo only: edits are kept in this browser)
      async adminSaveProgram(p) { const s = read(); s.admin.programs = s.admin.programs || {}; if (p.id && !String(p.id).startsWith("new_")) s.admin.programs[p.id] = Object.assign(s.admin.programs[p.id] || {}, p); else { s.admin.newPrograms = s.admin.newPrograms || []; p.id = p.id || "new_" + uid(); s.admin.newPrograms = s.admin.newPrograms.filter(x => x.id !== p.id).concat([p]); } write(s); return p; },
      async adminImportPrograms(rows) { for (const r of rows) { const all = await this.listProgramsAdmin(); const ex = all.find(p => p.slug === r.slug); await this.adminSaveProgram(Object.assign({}, ex || {}, r, ex ? { id: ex.id } : {})); } return rows.length; },
      async adminSaveCamp(c) { const s = read(); if (c.id && !String(c.id).startsWith("new_") && !(s.admin.newCamps || []).some(x => x.id === c.id)) { s.admin.camps = s.admin.camps || {}; s.admin.camps[c.id] = Object.assign(s.admin.camps[c.id] || {}, c); } else { c.id = c.id || "new_" + uid(); s.admin.newCamps = (s.admin.newCamps || []).filter(x => x.id !== c.id).concat([c]); } write(s); return c; },
      async adminDeleteCamp(id) { const s = read(); s.admin.deletedCamps = (s.admin.deletedCamps || []).concat([id]); s.admin.newCamps = (s.admin.newCamps || []).filter(x => x.id !== id); write(s); },
      async adminSaveRule(r) { const s = read(); if (r.id && !String(r.id).startsWith("new_")) { s.admin.rules = s.admin.rules || {}; s.admin.rules[r.id] = Object.assign(s.admin.rules[r.id] || {}, r); } else { r.id = r.id || "new_" + uid(); s.admin.newRules = (s.admin.newRules || []).filter(x => x.id !== r.id).concat([r]); } write(s); return r; },
      async adminStats() { const s = read(); const d = await directory(); const us = Object.values(s.users); return { accounts: us.filter(u => u.profile).length, saved_schools: us.reduce((n, u) => n + (u.saved_schools || []).length, 0), messages_logged: us.reduce((n, u) => n + (u.communications || []).length, 0), saved_camps: us.reduce((n, u) => n + (u.saved_camps || []).length, 0), programs: d.programs.length, programs_verified: d.programs.filter(p => p.record_status === "verified").length, camps_upcoming: L.filterCamps(d.camps, {}, new Date()).length }; }
    };
  }

  // =================================================================== LIVE backend (Supabase)
  function LiveBackend(sb) {
    let dirCache = null;
    async function pageAll(table, cols, filter) {
      let out = [], from = 0; const size = 1000;
      for (;;) {
        let q = sb.from(table).select(cols).range(from, from + size - 1);
        if (filter) q = filter(q);
        const { data, error } = await q; if (error) throw error;
        out = out.concat(data); if (data.length < size) break; from += size;
      }
      return out;
    }
    async function programs(admin) {
      if (!admin && dirCache) return dirCache;
      let rows = [];
      rows = await pageAll("programs", PROGRAM_COLS, q => q.order("name").order("id"));
      if (!admin) dirCache = rows;
      return rows;
    }
    async function must(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data; }
    function table(name) {
      return {
        list: async () => pageAll(name, "*", q => q.order("created_at").order("id")),
        insert: async row => must(sb.from(name).insert(row).select().single()),
        update: async (id, patch) => must(sb.from(name).update(patch).eq("id", id).select().single()),
        remove: async id => must(sb.from(name).delete().eq("id", id))
      };
    }
    const site = (window.PSR && window.PSR.siteBase) ? window.PSR.siteBase() : location.origin + location.pathname.replace(/[^/]*$/, "");
    return {
      mode: "live",
      async getUser() { const { data, error } = await sb.auth.getSession(); if (error) throw error; return data.session ? { id: data.session.user.id, email: data.session.user.email } : null; },
      onAuth(cb) { return sb.auth.onAuthStateChange(() => { setTimeout(() => Promise.resolve().then(cb).catch(e => console.error("Recruiting session refresh failed", e)), 0); }); },
      async signIn(email) {
        const { error } = await sb.auth.signInWithOtp({ email: String(email).trim(), options: { shouldCreateUser: true, emailRedirectTo: site.replace(/\/$/, "") + "/my-recruiting.html" } });
        if (error) {
          const code = String(error.code || ""), msg = String(error.message || "");
          if (code === "email_address_not_authorized" || /not authorized/i.test(msg)) throw new Error("Sign-up emails aren't turned on yet. The free tools still work without an account. DM us on Instagram and we'll let you know when accounts open.");
          if (error.status === 429 || /rate limit/i.test(msg)) throw new Error("Too many sign-in emails were sent in the last hour. Try again in a little while.");
          throw new Error(msg || "Sign-in failed. Try again.");
        }
        return { emailSent: true };
      },
      async signOut() { const { error } = await sb.auth.signOut(); if (error) throw error; },
      async isAdmin() { const { data, error } = await sb.rpc("is_recruiting_admin"); if (error) throw new Error(error.message); return data === true; },
      async listPrograms() { return programs(false); },
      async listProgramsAdmin() { return programs(true); },
      async listRules() { return pageAll("recruiting_rules", "*", q => q.order("level").order("id")); },
      async listCamps() {
        const camps = await pageAll("camps", "*", q => q.order("start_date").order("id"));
        return attachLevels(camps, await programs(false));
      },
      async listSavedCamps(ids) {
        if (!ids.length) return [];
        return attachLevels(await pageAll("camps", "*", q => q.in("id", ids).order("start_date").order("id")), await programs(false));
      },
      async getProfile() {
        const u = await this.getUser(); if (!u) return null;
        const rows = await must(sb.from("recruit_profiles").select("*").eq("user_id", u.id));
        return rows[0] || { user_id: u.id, contact_email: u.email, metrics: {}, prep: {}, levels_of_interest: [], regions: [] };
      },
      async saveProfile(p) {
        const u = await this.getUser(); if (!u) throw new Error("Sign in first."); const row = Object.assign({}, p, { user_id: u.id }); delete row.created_at; delete row.updated_at;
        return must(sb.from("recruit_profiles").upsert(row).select().single());
      },
      table,
      // Deletes everything this player saved in the recruiting tools. Row-level security limits each delete to their own rows.
      async deleteMyData() {
        const u = await this.getUser(); if (!u) throw new Error("Sign in first.");
        for (const t of ["communications", "email_drafts", "plan_tasks", "saved_camps", "saved_schools", "recruit_profiles"]) await must(sb.from(t).delete().eq("user_id", u.id));
      },
      async logEmailSent(draftId, occurredOn, followUpOn, coachName) {
        return must(sb.rpc("log_recruiting_email_sent", { p_draft_id: draftId, p_occurred_on: occurredOn, p_follow_up_on: followUpOn || null, p_coach_name: coachName || null }));
      },
      async adminSaveProgram(p) { const row = Object.assign({}, p); delete row.updated_at; if (!row.id || String(row.id).startsWith("p_") || String(row.id).startsWith("new_")) delete row.id; dirCache = null; return must(sb.from("programs").upsert(row, { onConflict: "slug" }).select().single()); },
      async adminImportPrograms(rows) { dirCache = null; let n = 0; for (let i = 0; i < rows.length; i += 200) { for (const row of rows.slice(i, i + 200)) await must(sb.from("programs").upsert(row, { onConflict: "slug", defaultToNull: false })); n += Math.min(200, rows.length - i); } return n; },
      async adminSaveCamp(c) { const row = Object.assign({}, c); ["level", "conference", "band", "program_name", "program_slug", "updated_at"].forEach(k => delete row[k]); if (!row.id || String(row.id).startsWith("new_")) delete row.id; return must(sb.from("camps").upsert(row).select().single()); },
      async adminDeleteCamp(id) { return must(sb.from("camps").delete().eq("id", id)); },
      async adminSaveRule(r) { const row = Object.assign({}, r); delete row.updated_at; if (!row.id || String(row.id).startsWith("r") && !/^[0-9a-f-]{36}$/.test(row.id)) delete row.id; return must(sb.from("recruiting_rules").upsert(row, { onConflict: "rule_key" }).select().single()); },
      async adminStats() { const { data, error } = await sb.rpc("recruiting_stats"); if (error) throw new Error(error.message); return data; }
    };
  }

  // A missing backend is a read-only directory, never an implicit passwordless
  // "account" in localStorage. The browser preview must be explicitly selected.
  function UnavailableBackend() {
    const message = "Saving and sign-in are temporarily unavailable. The site owner must connect the recruiting database. You can still browse the directory.";
    const blocked = async () => { throw new Error(message); };
    return {
      mode: "unavailable", unavailableReason: message,
      getUser: async () => null, onAuth() {}, signIn: blocked, signOut: async () => {}, isAdmin: async () => false,
      async listPrograms() { return (await loadFallback()).programs.filter(p => p.record_status !== "hidden"); },
      async listCamps() { const d = await loadFallback(); return attachLevels(d.camps.filter(c => c.record_status !== "hidden"), d.programs); },
      async listRules() { return (await loadFallback()).rules.filter(r => r.record_status !== "hidden"); },
      getProfile: async () => null, saveProfile: blocked, deleteMyData: blocked,
      table: () => ({ list: async () => [], insert: blocked, update: blocked, remove: blocked }),
      listProgramsAdmin: blocked, adminSaveProgram: blocked, adminImportPrograms: blocked,
      adminSaveCamp: blocked, adminDeleteCamp: blocked, adminSaveRule: blocked, adminStats: blocked
    };
  }

  // =================================================================== init
  let backend = null;
  function wantsDemo() {
    const p = new URLSearchParams(location.search);
    if (p.get("demo") === "1") { try { sessionStorage.setItem("psr_demo", "1"); } catch (e) {} return true; }
    if (p.get("demo") === "0") { try { sessionStorage.removeItem("psr_demo"); } catch (e) {} return false; }
    try { return sessionStorage.getItem("psr_demo") === "1"; } catch (e) { return false; }
  }
  function init() {
    if (backend) return backend;
    const demo = wantsDemo();
    const publicKey = CFG.supabasePublishableKey || CFG.supabaseAnonKey;
    const haveSb = window.PSR_SB || (window.supabase && CFG.supabaseUrl && publicKey);
    if (demo) backend = DemoBackend();
    else if (haveSb) {
      const sb = window.PSR_SB || (window.PSR_SB = window.supabase.createClient(CFG.supabaseUrl, publicKey));
      backend = LiveBackend(sb);
    } else backend = UnavailableBackend();
    return backend;
  }
  window.PSRData = { init, loadFallback };
})();
