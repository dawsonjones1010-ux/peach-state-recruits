/* My Recruiting: plan, saved schools, emails, tracker, saved camps, profile (my-recruiting.html) */
(function () {
  "use strict";
  const L = window.PSRLogic, U = window.PSRUI, { esc, $, $$ } = U;
  const api = window.PSRData.init();
  const TABS = [["plan", "Plan"], ["saved", "Saved schools"], ["emails", "Emails"], ["tracker", "Tracker"], ["camps", "Camps"], ["profile", "Profile"]];
  const STAGES = [["researching", "Researching"], ["contacted", "Contacted"], ["talking", "Talking"], ["visited", "Visited"], ["offered", "Offered"], ["committed", "Committed"], ["not_a_fit", "Not a fit"]];
  const PREP = [["video", "Highlight video ready"], ["ncaa_registered", "Registered with NCAA Eligibility Center"], ["naia_registered", "Registered with NAIA Eligibility Center (PlayNAIA)"], ["transcript", "Unofficial transcript ready to send"], ["test_scores", "SAT/ACT taken (if needed)"], ["schedule", "Summer/fall schedule ready to share"]];
  const RULE_TEXT = {
    profile_basics: "Shows when your name, grad year, position, high school or email is missing.",
    followups_due: "Shows when a follow-up date you set on a logged message has arrived.",
    reply_waiting: "Shows when the latest message you logged for a school came from the coach.",
    d1_contact_window: "Shows in the 75 days before Aug 1 before your junior year, if you're interested in D1 (or haven't picked levels).",
    video: "Shows until your profile has a video link or you check 'Highlight video ready'.",
    first_intros: "Shows when saved schools have no logged message and your profile is complete.",
    updates_due: "Shows when a school you've contacted hasn't heard from you in 60+ days.",
    build_list: "Shows until you've saved 10 schools.",
    ncaa_register: "Shows for sophomores and up interested in NCAA D1/D2 (or no level picked) until you check it off.",
    naia_register: "Shows for juniors and seniors with NAIA on their list until you check it off.",
    second_level: "Shows when 5+ saved schools are all the same level.",
    find_camp: "Shows when you have saved schools but no saved camps."
  };

  const S = { user: null, profile: null, programs: [], byId: new Map(), saved: [], drafts: [], comms: [], tasks: [], camps: [], savedCamps: [], rules: [] };
  const today = () => L.toISO(new Date());
  const pname = id => (S.byId.get(id) || {}).name || "";
  const plevel = id => (S.byId.get(id) || {}).level || "";

  async function loadAll() {
    const [profile, programs, saved, drafts, comms, tasks, camps, savedCamps, rules] = await Promise.all([
      api.getProfile(), api.listPrograms(), api.table("saved_schools").list(), api.table("email_drafts").list(),
      api.table("communications").list(), api.table("plan_tasks").list(), api.listCamps(), api.table("saved_camps").list(), api.listRules()
    ]);
    Object.assign(S, { profile, programs, saved, drafts, comms, tasks, camps, savedCamps, rules });
    S.byId = new Map(programs.map(p => [p.id, p]));
  }

  // ------------------------------------------------------------ routing
  function parseHash() {
    const h = location.hash.replace(/^#/, "");
    const [tab, qs] = h.split("?");
    return { tab: TABS.some(t => t[0] === tab) ? tab : "plan", params: new URLSearchParams(qs || "") };
  }
  function shell() {
    const { tab } = parseHash();
    const counts = { saved: S.saved.length, emails: S.drafts.filter(d => d.status === "draft").length, tracker: L.dueFollowUps(S.comms, today()).length, camps: S.savedCamps.length };
    $("#app").innerHTML = `
      ${U.demoBanner(api)}
      <div class="rc-spread" style="margin-bottom:8px"><p class="rc-muted" style="margin:0">Signed in as <b>${esc(S.user.email || "")}</b></p><button class="rc-btn sm" id="signOut">Sign out</button></div>
      <nav class="rc-tabs" role="tablist" aria-label="My Recruiting">${TABS.map(([k, l]) => `<a class="rc-tab" role="tab" href="#${k}" aria-selected="${k === tab}">${l}${counts[k] ? `<span class="rc-count">${counts[k]}</span>` : ""}</a>`).join("")}</nav>
      <div id="tab"></div>`;
    $("#signOut").onclick = async () => { await api.signOut(); location.hash = ""; start(); };
    ({ plan: renderPlan, saved: renderSaved, emails: renderEmails, tracker: renderTracker, camps: renderCamps, profile: renderProfile })[tab]();
  }

  // ------------------------------------------------------------ PLAN
  function ruleLink(key) {
    const r = S.rules.find(x => x.rule_key === key);
    if (!r || !U.safeUrl(r.source_url)) return "";
    return `<a class="rc-link" href="${esc(r.source_url)}" target="_blank" rel="noopener">Official source</a>${r.last_checked ? ` <span class="rc-small">(checked ${esc(L.fmtDate(r.last_checked))})</span>` : ""}`;
  }
  function plan() {
    const cands = L.planCandidates({ profile: S.profile, saved: S.saved, comms: S.comms, savedCamps: S.savedCamps, today: today(), programName: pname, programLevel: plevel });
    return L.planView(cands, S.tasks, today(), 3);
  }
  function taskCard(t, compact) {
    const a = t.action;
    return `<article class="rc-task${t.status === "done" ? " done" : ""}" data-task="${esc(t.rule_key || t.id)}">
      <h3>${esc(t.title)}</h3>
      ${t.detail ? `<p>${esc(t.detail)}</p>` : ""}
      <p class="rc-why">Why this shows: ${esc(t.why || "")}${t.ruleRef ? ` · ${ruleLink(t.ruleRef)}` : ""}${t.status === "postponed" && t.postponed_until ? ` · Postponed until ${esc(L.fmtDate(t.postponed_until))}` : ""}</p>
      ${compact ? "" : `<div class="rc-row">
        ${a ? `<a class="rc-btn sm primary" href="${esc(a.href)}"${a.external ? ' target="_blank" rel="noopener"' : ""}>${esc(a.label)}</a>` : ""}
        ${t.status !== "done" ? `<button class="rc-btn sm" data-act="done">Mark done</button><button class="rc-btn sm" data-act="postpone">Postpone</button>` : `<button class="rc-btn sm" data-act="reopen">Reopen</button>`}
        <button class="rc-btn sm" data-act="edit">Edit</button>
        ${t.custom ? `<button class="rc-btn sm danger" data-act="delete">Delete</button>` : `<button class="rc-btn sm" data-act="dismiss">Not relevant</button>`}
      </div>`}
    </article>`;
  }
  function renderPlan() {
    const p = S.profile, v = plan();
    const cy = p.grad_year ? L.classYear(p.grad_year, today()) : null;
    const kd = p.grad_year ? L.keyDates(p.grad_year) : null;
    const later = v.all.filter(t => !v.next.includes(t));
    $("#tab").innerHTML = `
      <div class="rc-cols" style="grid-template-columns:minmax(0,1fr) 320px">
        <div>
          <h2 style="font-size:40px;margin:0 0 12px">Your next 3 steps</h2>
          <div class="rc-tasks">${v.next.map(t => taskCard(t)).join("") || `<div class="rc-empty">Nothing urgent. Nice work. Add your own task below or check back after you log new messages.</div>`}</div>
          <details class="rc-panel" style="margin-top:16px"><summary><b>Everything else (${later.length})</b></summary>
            <div class="rc-tasks" style="margin-top:12px">${later.map(t => taskCard(t)).join("") || `<p class="rc-muted">No other tasks.</p>`}</div>
          </details>
          <form class="rc-panel" id="addTask" style="margin-top:16px">
            <h3>Add your own task</h3>
            <div class="rc-grid2"><label class="rc-field">Task<input class="rc-input" name="title" required maxlength="140" placeholder="e.g. Ask coach for a recommendation"></label>
            <label class="rc-field">Due date <small>(optional)</small><input class="rc-input" type="date" name="due_on"></label></div>
            <label class="rc-field" style="margin-top:10px">Notes <small>(optional)</small><input class="rc-input" name="detail" maxlength="400"></label>
            <button class="rc-btn primary" style="margin-top:12px">Add task</button>
          </form>
        </div>
        <aside>
          <section class="rc-panel">
            <h3>Your timeline</h3>
            ${p.grad_year ? `<dl class="rc-dl"><dt>Class</dt><dd>${esc(p.grad_year)} (${esc(cy.label)})</dd>
              <dt>D1 contact</dt><dd>${esc(L.fmtDate(kd.d1Contact))}<br>${ruleLink("d1_contact_start")}</dd>
              <dt>D2 contact</dt><dd>${esc(L.fmtDate(kd.d2Contact))}<br>${ruleLink("d2_contact_start") || ""}${(S.rules.find(r => r.rule_key === "d2_contact_start") || {}).record_status === "needs_review" ? ' <span class="rc-badge warn">Source under review</span>' : ""}</dd></dl>`
              : `<p class="rc-muted" style="margin:0">Add your grad year in <a class="rc-link" href="#profile">Profile</a> to see your key dates.</p>`}
          </section>
          <section class="rc-panel">
            <h3>Getting ready</h3>
            <div class="rc-checks" id="prep">${PREP.map(([k, l]) => `<label class="rc-check"><input type="checkbox" data-prep="${k}"${(p.prep || {})[k] ? " checked" : ""}>${esc(l)}</label>`).join("")}</div>
          </section>
          <details class="rc-panel"><summary><b>How these steps are chosen</b></summary>
            <p class="rc-small">Each step comes from a fixed rule using your grad year, profile, saved schools and the messages you log. Nothing is guessed about you, and no step predicts interest from any school.</p>
            <ul class="rc-small" style="padding-left:18px">${L.PLAN_RULES.map(r => `<li><b>${esc(r.key.replace(/_/g, " "))}</b>: ${esc(RULE_TEXT[r.key] || "")}</li>`).join("")}</ul>
            <p class="rc-small"><b>Recruiting rules we use</b></p>
            <ul class="rc-small" style="padding-left:18px">${S.rules.map(r => `<li>${esc(r.level)}: ${esc(r.summary)} ${U.safeUrl(r.source_url) ? `<a class="rc-link" href="${esc(r.source_url)}" target="_blank" rel="noopener">Source</a>` : ""}${r.record_status === "needs_review" ? ' <span class="rc-badge warn">Under review</span>' : ""}</li>`).join("")}</ul>
          </details>
        </aside>
      </div>`;
    $$("#prep input").forEach(cb => cb.onchange = async () => {
      S.profile.prep = Object.assign({}, S.profile.prep || {}, { [cb.dataset.prep]: cb.checked });
      S.profile = await api.saveProfile({ prep: S.profile.prep }).catch(e => (U.toast(e.message), S.profile)) || S.profile;
      shell();
    });
    $("#addTask").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try {
        const r = await api.table("plan_tasks").insert({ title: f.title.value.trim(), detail: f.detail.value.trim() || null, due_on: f.due_on.value || null, status: "open" });
        S.tasks.push(r); U.toast("Task added"); shell();
      } catch (err) { U.toast(err.message); }
    };
    $$("[data-task] [data-act]").forEach(b => b.onclick = () => taskAction(b.closest("[data-task]").dataset.task, b.dataset.act, v.all));
  }
  async function saveTaskState(t, patch) {
    const tbl = api.table("plan_tasks");
    let row = t.custom ? S.tasks.find(x => x.id === t.id) : S.tasks.find(x => x.rule_key === t.rule_key);
    if (row) { const r = await tbl.update(row.id, patch); Object.assign(row, r); }
    else { const r = await tbl.insert(Object.assign({ rule_key: t.rule_key, title: t.title, detail: t.detail || null }, patch)); S.tasks.push(r); }
  }
  async function taskAction(key, act, all) {
    const t = all.find(x => (x.rule_key || x.id) === key); if (!t) return;
    try {
      if (act === "done") await saveTaskState(t, { status: "done", completed_at: new Date().toISOString(), rule_subkey: t.subkey || null });
      else if (act === "dismiss") await saveTaskState(t, { status: "dismissed", rule_subkey: t.subkey || null });
      else if (act === "reopen") await saveTaskState(t, { status: "open", completed_at: null, postponed_until: null });
      else if (act === "delete") { if (await U.confirmDialog("Delete this task?")) { await api.table("plan_tasks").remove(t.id); S.tasks = S.tasks.filter(x => x.id !== t.id); } }
      else if (act === "postpone") {
        const def = L.toISO(L.addDays(today(), 7));
        U.openDialog(`<form method="dialog" id="pp"><h2>Postpone</h2><label class="rc-field">Show this again on<input class="rc-input" type="date" name="d" value="${def}" min="${L.toISO(L.addDays(today(), 1))}" required></label><div class="rc-dlg-actions"><button class="rc-btn" value="cancel" formnovalidate>Cancel</button><button class="rc-btn primary" value="ok">Postpone</button></div></form>`, d => {
          $("#pp", d).onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault(); await saveTaskState(t, { status: "postponed", postponed_until: e.target.d.value }); d.close(); U.toast("Postponed"); shell(); };
        });
        return;
      } else if (act === "edit") {
        U.openDialog(`<form method="dialog" id="ed"><h2>Edit task</h2><label class="rc-field">Task<input class="rc-input" name="title" value="${esc(t.title)}" required maxlength="140"></label><label class="rc-field" style="margin-top:10px">Notes<textarea class="rc-textarea" style="min-height:100px" name="detail">${esc(t.detail || "")}</textarea></label>${t.custom ? `<label class="rc-field" style="margin-top:10px">Due date<input class="rc-input" type="date" name="due_on" value="${esc(t.due_on || "")}"></label>` : ""}<div class="rc-dlg-actions"><button class="rc-btn" value="cancel" formnovalidate>Cancel</button><button class="rc-btn primary" value="ok">Save</button></div></form>`, d => {
          $("#ed", d).onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault(); const f = e.target; const patch = { title: f.title.value.trim(), detail: f.detail.value.trim() || null, edited: true }; if (f.due_on) patch.due_on = f.due_on.value || null; await saveTaskState(t, patch); d.close(); U.toast("Saved"); shell(); };
        });
        return;
      }
      shell();
    } catch (e) { U.toast(e.message); }
  }

  // ------------------------------------------------------------ SAVED SCHOOLS
  function renderSaved() {
    const rows = S.saved.map(s => ({ s, p: S.byId.get(s.program_id) || { name: "(school removed)", level: "" }, st: L.schoolStatus(s.program_id, S.comms) }))
      .sort((a, b) => ["high", "medium", "low"].indexOf(a.s.interest) - ["high", "medium", "low"].indexOf(b.s.interest) || a.p.name.localeCompare(b.p.name));
    const lv = {}; rows.forEach(r => lv[r.p.level] = (lv[r.p.level] || 0) + 1);
    $("#tab").innerHTML = `
      <div class="rc-spread" style="margin-bottom:12px"><p style="margin:0"><b>${rows.length}</b> saved school${rows.length === 1 ? "" : "s"}${Object.keys(lv).length ? ` · ${Object.entries(lv).map(([k, n]) => `${esc(k)} ${n}`).join(" · ")}` : ""}</p><a class="rc-btn primary" href="colleges.html">Find schools</a></div>
      <div class="rc-list">${rows.map(({ s, p, st }) => `
        <article class="rc-panel" data-saved="${esc(s.id)}">
          <div class="rc-spread"><div><h3 style="margin:0 0 4px;font-family:var(--body);font-weight:800;font-size:18px;text-transform:none;letter-spacing:0;line-height:1.3"><a href="colleges.html#school=${encodeURIComponent(p.slug || "")}">${esc(p.name)}</a></h3>
            <div class="rc-meta" style="margin:0">${p.level ? U.levelBadge(p.level) : ""}<span>${esc([p.city, p.state].filter(Boolean).join(", "))}</span>
            <span>${st.sent} sent · ${st.received} received${st.lastOn ? ` · last ${esc(L.fmtDate(st.lastOn))}` : ""}</span>${st.awaitingReply ? '<span class="rc-badge peach">Coach replied</span>' : ""}</div></div>
            <div class="rc-row"><a class="rc-btn sm primary" href="#emails?program=${esc(s.program_id)}&kind=${st.sent ? "update" : "introduction"}">Draft email</a><a class="rc-btn sm" href="#tracker?program=${esc(s.program_id)}">Log message</a></div></div>
          <div class="rc-grid3" style="margin-top:12px">
            <label class="rc-field">Interest<select class="rc-select" data-f="interest">${["high", "medium", "low"].map(x => `<option${x === s.interest ? " selected" : ""}>${x}</option>`).join("")}</select></label>
            <label class="rc-field">Stage<select class="rc-select" data-f="stage">${STAGES.map(([k, l]) => `<option value="${k}"${k === s.stage ? " selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="rc-field">Coach name <small>(from the school's staff page)</small><input class="rc-input" data-f="coach_name" value="${esc(s.coach_name || "")}" maxlength="80"></label>
          </div>
          <div class="rc-grid2" style="margin-top:10px">
            <label class="rc-field">Coach email<input class="rc-input" type="email" data-f="coach_email" value="${esc(s.coach_email || "")}" maxlength="120"></label>
            <label class="rc-field">Notes<input class="rc-input" data-f="notes" value="${esc(s.notes || "")}" maxlength="500"></label>
          </div>
          <div class="rc-row" style="margin-top:10px;justify-content:flex-end"><button class="rc-btn sm danger" data-remove>Remove</button></div>
        </article>`).join("") || `<div class="rc-empty">No saved schools yet. Use the <a class="rc-link" href="colleges.html">College Finder</a> to save programs.</div>`}</div>`;
    $$("[data-saved]").forEach(card => {
      const id = card.dataset.saved;
      $$("[data-f]", card).forEach(inp => inp.onchange = async () => {
        if (inp.type === "email" && inp.value && !inp.checkValidity()) { U.toast("Check the email address"); return; }
        try { const r = await api.table("saved_schools").update(id, { [inp.dataset.f]: inp.value.trim() || null }); Object.assign(S.saved.find(x => x.id === id), r); U.toast("Saved"); } catch (e) { U.toast(e.message); }
      });
      $("[data-remove]", card).onclick = async () => {
        if (!(await U.confirmDialog("Remove this school from your list? Your logged messages stay in the tracker."))) return;
        await api.table("saved_schools").remove(id); S.saved = S.saved.filter(x => x.id !== id); shell();
      };
    });
  }

  // ------------------------------------------------------------ EMAILS
  function renderEmails() {
    const { params } = parseHash();
    const progId = params.get("program") || (S.saved[0] && S.saved[0].program_id) || "";
    const kind = L.KINDS[params.get("kind")] ? params.get("kind") : "introduction";
    const draftId = params.get("draft");
    const draft = draftId ? S.drafts.find(d => d.id === draftId) : null;
    const savedOpts = S.saved.map(s => [s.program_id, pname(s.program_id)]).sort((a, b) => a[1].localeCompare(b[1]));
    $("#tab").innerHTML = `
      <div class="rc-cols" style="grid-template-columns:minmax(0,1fr) 300px">
        <form class="rc-panel" id="composer" novalidate>
          <h2>Write to a coach</h2>
          ${L.profileMissing(S.profile).length ? `<p class="rc-note">Your profile is missing: ${esc(L.profileMissing(S.profile).join(", "))}. <a class="rc-link" href="#profile">Add it</a> and drafts fill in automatically.</p>` : ""}
          <div class="rc-grid2">
            <label class="rc-field">School<select class="rc-select" name="program"><option value="">Choose a saved school</option>${savedOpts.map(([id, n]) => `<option value="${esc(id)}"${id === (draft ? draft.program_id : progId) ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
            <label class="rc-field">Type<select class="rc-select" name="kind">${Object.entries(L.KINDS).map(([k, l]) => `<option value="${k}"${k === (draft ? draft.kind : kind) ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          </div>
          <div class="rc-grid2" style="margin-top:10px">
            <label class="rc-field">Coach name<input class="rc-input" name="coach" maxlength="80"></label>
            <label class="rc-field">To (coach email)<input class="rc-input" type="email" name="to" maxlength="120" value="${esc(draft ? draft.to_email || "" : "")}"></label>
          </div>
          <div id="eventBox" style="margin-top:10px"></div>
          <label class="rc-field" style="margin-top:10px">Subject<input class="rc-input" name="subject" maxlength="200"></label>
          <label class="rc-field" style="margin-top:10px">Message<textarea class="rc-textarea" name="body" style="min-height:340px"></textarea></label>
          <p class="rc-small">Edit anything. Replace every [bracket] before sending. Coach emails come from the school's official staff page. We don't list them.</p>
          <div class="rc-row" style="margin-top:6px">
            <button class="rc-btn" type="button" id="regen">Start over from template</button>
            <button class="rc-btn" type="button" id="copyAll">Copy</button>
            <a class="rc-btn" id="openMail" href="#">Open in email app</a>
            <button class="rc-btn" type="button" id="saveDraft">Save draft</button>
            <button class="rc-btn primary" type="button" id="markSent">I sent it</button>
          </div>
        </form>
        <aside>
          <section class="rc-panel"><h3>Drafts</h3>
            ${S.drafts.filter(d => d.status === "draft").map(d => `<div class="rc-spread" style="padding:8px 0;border-bottom:1px solid var(--line)"><a class="rc-link" href="#emails?draft=${esc(d.id)}">${esc(L.KINDS[d.kind])}: ${esc(pname(d.program_id) || "No school")}</a><button class="rc-btn sm danger" data-deldraft="${esc(d.id)}" aria-label="Delete draft">Delete</button></div>`).join("") || `<p class="rc-muted" style="margin:0">No saved drafts.</p>`}
          </section>
          <section class="rc-panel"><h3>Tips</h3><ul class="rc-small" style="padding-left:18px;margin:0">
            <li>One school per email. Say why that school.</li><li>Put grad year, position and video link up top.</li><li>Use "I sent it" so the tracker can remind you to follow up.</li></ul></section>
        </aside>
      </div>`;
    const f = $("#composer");
    const ss = () => S.saved.find(s => s.program_id === f.program.value) || {};
    function eventBox() {
      if (f.kind.value !== "event_invite") { $("#eventBox").innerHTML = ""; return; }
      const mine = S.savedCamps.map(sc => S.camps.find(c => c.id === sc.camp_id)).filter(Boolean);
      $("#eventBox").innerHTML = `<label class="rc-field">Event<select class="rc-select" name="event"><option value="">Type event details below</option>${mine.map(c => `<option value="${esc(c.id)}">${esc(c.title)} · ${esc(L.fmtDate(c.start_date))}</option>`).join("")}</select></label>
        <div class="rc-grid3" style="margin-top:8px"><label class="rc-field">Event name<input class="rc-input" name="evTitle"></label><label class="rc-field">Date<input class="rc-input" type="date" name="evDate"></label><label class="rc-field">City, state<input class="rc-input" name="evWhere"></label></div>`;
      f.event.onchange = () => { const c = S.camps.find(x => x.id === f.event.value); if (c) { f.evTitle.value = c.title; f.evDate.value = c.start_date; f.evWhere.value = [c.city, c.state].filter(Boolean).join(", "); fill(); } };
      ["evTitle", "evDate", "evWhere"].forEach(n => f[n].oninput = fill);
    }
    function ctx() {
      const prog = S.byId.get(f.program.value);
      const st = L.schoolStatus(f.program.value, S.comms);
      const ev = f.evTitle ? { title: f.evTitle.value, start_date: f.evDate.value, city: f.evWhere.value } : null;
      return { profile: S.profile, program: prog, coachName: f.coach.value, lastSentOn: st.lastSentOn, event: ev };
    }
    function fill() { const e = L.buildEmail(f.kind.value, ctx()); f.subject.value = e.subject; f.body.value = e.body; mail(); }
    function mail() { $("#openMail").href = L.mailtoUrl(f.to.value, f.subject.value, f.body.value); }
    function syncSchool() { const s = ss(); f.coach.value = s.coach_name || ""; if (!draft) f.to.value = s.coach_email || ""; }
    syncSchool(); eventBox();
    if (draft) { f.subject.value = draft.subject || ""; f.body.value = draft.body || ""; mail(); } else fill();
    f.program.onchange = () => { syncSchool(); fill(); };
    f.kind.onchange = () => { eventBox(); fill(); };
    f.coach.oninput = fill;
    [f.to, f.subject, f.body].forEach(i => i.oninput = mail);
    $("#regen").onclick = fill;
    $("#copyAll").onclick = () => U.copy(`Subject: ${f.subject.value}\n\n${f.body.value}`, "Email copied");
    $("#openMail").onclick = e => { if (!f.to.value) { U.toast("No coach email. Your email app will open without one."); } };
    $("#saveDraft").onclick = async () => {
      const row = { program_id: f.program.value || null, kind: f.kind.value, to_email: f.to.value || null, subject: f.subject.value, body: f.body.value, status: "draft" };
      try {
        if (draft) { Object.assign(draft, await api.table("email_drafts").update(draft.id, row)); }
        else { const r = await api.table("email_drafts").insert(row); S.drafts.push(r); history.replaceState(null, "", "#emails?draft=" + r.id); }
        U.toast("Draft saved"); shell();
      } catch (e) { U.toast(e.message); }
    };
    $("#markSent").onclick = () => {
      if (!f.program.value) { U.toast("Choose the school first"); return; }
      const fu = L.toISO(L.addDays(today(), 10));
      U.openDialog(`<form method="dialog" id="sent"><h2>Log as sent</h2><p class="rc-muted">Only confirm after you've actually sent it from your email.</p>
        <div class="rc-grid2"><label class="rc-field">Sent on<input class="rc-input" type="date" name="on" value="${today()}" max="${today()}" required></label>
        <label class="rc-field">Remind me to follow up <small>(optional)</small><input class="rc-input" type="date" name="fu" value="${fu}"></label></div>
        <div class="rc-dlg-actions"><button class="rc-btn" value="cancel" formnovalidate>Cancel</button><button class="rc-btn primary" value="ok">Log it</button></div></form>`, d => {
        $("#sent", d).onsubmit = async e => {
          if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault();
          try {
            let dId = draft ? draft.id : null;
            const drow = { program_id: f.program.value, kind: f.kind.value, to_email: f.to.value || null, subject: f.subject.value, body: f.body.value, status: "sent" };
            if (draft) await api.table("email_drafts").update(draft.id, drow); else { const r = await api.table("email_drafts").insert(drow); S.drafts.push(r); dId = r.id; }
            if (draft) draft.status = "sent";
            const c = await api.table("communications").insert({ program_id: f.program.value, draft_id: dId, direction: "sent", kind: f.kind.value, channel: "email", coach_name: f.coach.value || null, subject: f.subject.value, occurred_on: e.target.on.value, follow_up_on: e.target.fu.value || null });
            S.comms.push(c);
            const s = ss();
            if (s.id && s.stage === "researching") { Object.assign(s, await api.table("saved_schools").update(s.id, { stage: "contacted" })); }
            if (s.id && f.coach.value && !s.coach_name) Object.assign(s, await api.table("saved_schools").update(s.id, { coach_name: f.coach.value }));
            d.close(); U.toast("Logged in your tracker"); location.hash = "#tracker?program=" + f.program.value;
          } catch (err) { U.toast(err.message); }
        };
      });
    };
    $$("[data-deldraft]").forEach(b => b.onclick = async () => { if (!(await U.confirmDialog("Delete this draft?"))) return; await api.table("email_drafts").remove(b.dataset.deldraft); S.drafts = S.drafts.filter(d => d.id !== b.dataset.deldraft); location.hash = "#emails"; shell(); });
  }

  // ------------------------------------------------------------ TRACKER
  function renderTracker() {
    const { params } = parseHash();
    const filt = params.get("program") || "";
    const due = L.dueFollowUps(S.comms, today());
    const list = S.comms.filter(c => !filt || c.program_id === filt).sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)) || String(b.created_at).localeCompare(String(a.created_at)));
    const progOpts = [...new Set(S.saved.map(s => s.program_id).concat(S.comms.map(c => c.program_id)).filter(Boolean))].map(id => [id, pname(id)]).sort((a, b) => a[1].localeCompare(b[1]));
    $("#tab").innerHTML = `
      ${due.length ? `<section class="rc-panel" style="border-color:var(--peach)"><h3>Follow-ups due</h3><div class="rc-log">${due.map(c => `
        <div class="rc-log-item"><span class="rc-small">${esc(L.fmtDate(c.follow_up_on))}</span><div><b>${esc(pname(c.program_id))}</b><br><span class="rc-small">${esc(c.subject || L.KINDS[c.kind] || c.kind)}</span></div>
        <div class="rc-row"><a class="rc-btn sm primary" href="#emails?kind=follow_up&program=${esc(c.program_id)}">Draft follow-up</a><button class="rc-btn sm" data-fudone="${esc(c.id)}">Done</button></div></div>`).join("")}</div></section>` : ""}
      <div class="rc-cols" style="grid-template-columns:minmax(0,1fr) 340px">
        <section>
          <div class="rc-spread" style="margin-bottom:10px"><h2 style="font-size:36px;margin:0">Message history</h2>
            <label class="rc-field" style="min-width:220px"><span class="rc-hide">Filter</span><select class="rc-select" id="filt"><option value="">All schools</option>${progOpts.map(([id, n]) => `<option value="${esc(id)}"${id === filt ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
          <div class="rc-log">${list.map(c => `
            <div class="rc-log-item" data-comm="${esc(c.id)}">
              <div><span class="rc-dir ${c.direction}">${c.direction === "sent" ? "You sent" : "Received"}</span><br><span class="rc-small">${esc(L.fmtDate(c.occurred_on))}</span></div>
              <div><b>${esc(pname(c.program_id) || "No school")}</b>${c.coach_name ? ` · ${esc(c.coach_name)}` : ""}<br>
                <span>${esc(c.subject || c.summary || L.KINDS[c.kind] || c.kind)}</span><span class="rc-small"> · ${esc(c.channel.replace("_", " "))}</span>
                ${c.notes ? `<p class="rc-small" style="margin:4px 0 0">${esc(c.notes)}</p>` : ""}
                ${c.follow_up_on ? `<p class="rc-small" style="margin:4px 0 0">Follow up ${esc(L.fmtDate(c.follow_up_on))}${c.follow_up_done ? " (done)" : ""}</p>` : ""}</div>
              <div class="rc-row"><button class="rc-btn sm" data-edit>Edit</button><button class="rc-btn sm danger" data-del>Delete</button></div>
            </div>`).join("") || `<div class="rc-empty">Nothing logged yet. Log messages you send and replies you get, and the plan will tell you when to follow up.</div>`}</div>
        </section>
        <aside><form class="rc-panel" id="logForm"><h3>Log a message</h3>${commFields({ program_id: filt, direction: "received", channel: "email", kind: "reply", occurred_on: today() }, progOpts)}<button class="rc-btn primary" style="margin-top:12px;width:100%">Save to tracker</button></form></aside>
      </div>`;
    $("#filt").onchange = e => { location.hash = "#tracker" + (e.target.value ? "?program=" + e.target.value : ""); };
    $("#logForm").onsubmit = async e => { e.preventDefault(); const row = readComm(e.target); if (!row) return; try { S.comms.push(await api.table("communications").insert(row)); U.toast("Logged"); shell(); } catch (err) { U.toast(err.message); } };
    $$("[data-fudone]").forEach(b => b.onclick = async () => { const c = S.comms.find(x => x.id === b.dataset.fudone); Object.assign(c, await api.table("communications").update(c.id, { follow_up_done: true })); shell(); });
    $$("[data-comm]").forEach(item => {
      const c = S.comms.find(x => x.id === item.dataset.comm);
      $("[data-del]", item).onclick = async () => { if (!(await U.confirmDialog("Delete this entry?"))) return; await api.table("communications").remove(c.id); S.comms = S.comms.filter(x => x.id !== c.id); shell(); };
      $("[data-edit]", item).onclick = () => U.openDialog(`<form method="dialog" id="ec"><h2>Edit entry</h2>${commFields(c, progOpts)}<label class="rc-check" style="margin-top:8px"><input type="checkbox" name="fudone"${c.follow_up_done ? " checked" : ""}>Follow-up done</label><div class="rc-dlg-actions"><button class="rc-btn" value="cancel" formnovalidate>Cancel</button><button class="rc-btn primary" value="ok">Save</button></div></form>`, d => {
        $("#ec", d).onsubmit = async e => { if (e.submitter && e.submitter.value === "cancel") return; e.preventDefault(); const row = readComm(e.target); if (!row) return; row.follow_up_done = e.target.fudone.checked; Object.assign(c, await api.table("communications").update(c.id, row)); d.close(); shell(); };
      });
    });
  }
  function commFields(c, progOpts) {
    const opt = (v, l, cur) => `<option value="${v}"${v === cur ? " selected" : ""}>${l}</option>`;
    return `<label class="rc-field">School<select class="rc-select" name="program" required><option value="">Choose</option>${progOpts.map(([id, n]) => opt(esc(id), esc(n), c.program_id)).join("")}</select></label>
      <div class="rc-grid2" style="margin-top:8px"><label class="rc-field">Direction<select class="rc-select" name="direction">${opt("received", "Coach to me", c.direction)}${opt("sent", "Me to coach", c.direction)}</select></label>
      <label class="rc-field">How<select class="rc-select" name="channel">${[["email", "Email"], ["phone", "Phone call"], ["text", "Text"], ["dm", "Social DM"], ["in_person", "In person"], ["other", "Other"]].map(([v, l]) => opt(v, l, c.channel)).join("")}</select></label></div>
      <div class="rc-grid2" style="margin-top:8px"><label class="rc-field">Type<select class="rc-select" name="kind">${[["reply", "Reply"], ["introduction", "Introduction"], ["update", "Update"], ["event_invite", "Event invitation"], ["follow_up", "Follow-up"], ["call", "Call"], ["visit", "Visit"], ["other", "Other"]].map(([v, l]) => opt(v, l, c.kind)).join("")}</select></label>
      <label class="rc-field">Date<input class="rc-input" type="date" name="on" value="${esc(c.occurred_on || today())}" max="${today()}" required></label></div>
      <label class="rc-field" style="margin-top:8px">Coach name<input class="rc-input" name="coach" value="${esc(c.coach_name || "")}" maxlength="80"></label>
      <label class="rc-field" style="margin-top:8px">Subject or summary<input class="rc-input" name="subject" value="${esc(c.subject || c.summary || "")}" maxlength="200"></label>
      <label class="rc-field" style="margin-top:8px">Notes<textarea class="rc-textarea" style="min-height:70px" name="notes">${esc(c.notes || "")}</textarea></label>
      <label class="rc-field" style="margin-top:8px">Follow up on <small>(optional)</small><input class="rc-input" type="date" name="fu" value="${esc(c.follow_up_on || "")}"></label>`;
  }
  function readComm(f) {
    if (!f.program.value) { U.toast("Choose a school"); return null; }
    if (!f.on.value) { U.toast("Add the date"); return null; }
    return { program_id: f.program.value, direction: f.direction.value, channel: f.channel.value, kind: f.kind.value, occurred_on: f.on.value, coach_name: f.coach.value.trim() || null, subject: f.subject.value.trim() || null, notes: f.notes.value.trim() || null, follow_up_on: f.fu.value || null };
  }

  // ------------------------------------------------------------ CAMPS (saved)
  function renderCamps() {
    const rows = S.savedCamps.map(sc => ({ sc, c: S.camps.find(c => c.id === sc.camp_id) })).filter(r => r.c).sort((a, b) => a.c.start_date.localeCompare(b.c.start_date));
    const gone = S.savedCamps.length - rows.length;
    $("#tab").innerHTML = `
      <div class="rc-spread" style="margin-bottom:12px"><p style="margin:0"><b>${rows.length}</b> saved camp${rows.length === 1 ? "" : "s"}${gone ? ` · ${gone} past or removed` : ""}</p>
        <div class="rc-row">${rows.length ? `<button class="rc-btn" id="icsAll">Add all to calendar (.ics)</button>` : ""}<a class="rc-btn primary" href="camps.html">Find camps</a></div></div>
      <div class="rc-list">${rows.map(({ sc, c }) => campCard(sc, c)).join("") || `<div class="rc-empty">No saved camps. Use the <a class="rc-link" href="camps.html">Camp Finder</a>.</div>`}</div>`;
    if ($("#icsAll")) $("#icsAll").onclick = () => U.download("peach-state-camps.ics", L.buildICS(rows.map(r => r.c)), "text/calendar");
    $$("[data-sc]").forEach(card => {
      const sc = S.savedCamps.find(x => x.id === card.dataset.sc), c = S.camps.find(x => x.id === sc.camp_id);
      const recalc = () => { const t = readTravel(card); $("[data-total]", card).textContent = L.money(L.travelEstimate(t, c).total); return t; };
      $$("[data-t]", card).forEach(i => i.oninput = recalc);
      $("[data-savetravel]", card).onclick = async () => { try { Object.assign(sc, await api.table("saved_camps").update(sc.id, { travel: recalc() })); U.toast("Estimate saved"); } catch (e) { U.toast(e.message); } };
      $("[data-status]", card).onchange = async e => { Object.assign(sc, await api.table("saved_camps").update(sc.id, { status: e.target.value })); U.toast("Saved"); };
      $("[data-ics]", card).onclick = () => U.download(L.slugify(c.title) + ".ics", L.buildICS([c]), "text/calendar");
      $("[data-unsave]", card).onclick = async () => { if (!(await U.confirmDialog("Remove this camp from your list?"))) return; await api.table("saved_camps").remove(sc.id); S.savedCamps = S.savedCamps.filter(x => x.id !== sc.id); shell(); };
    });
  }
  function campCard(sc, c) {
    const t = Object.assign({}, L.TRAVEL_DEFAULTS, sc.travel || {});
    const est = L.travelEstimate(t, c);
    const fld = (k, l, step) => `<label class="rc-field">${l}<input class="rc-input" type="number" min="0" step="${step || 1}" data-t="${k}" value="${esc(t[k])}"></label>`;
    return `<article class="rc-panel" data-sc="${esc(sc.id)}">
      <div class="rc-camp"><div class="rc-date"><b>${esc(String(L.parseISO(c.start_date).getDate()))}</b><span>${esc(L.fmtDate(c.start_date, { month: "short" }))}</span></div>
        <div><h3 style="margin:0;font-family:var(--body);font-weight:800;font-size:18px;text-transform:none;letter-spacing:0;line-height:1.3">${esc(c.title)}</h3>
          <div class="rc-meta">${c.level ? U.levelBadge(c.level) : ""}<span>${esc(c.program_name || c.host_name || "")}</span><span>${esc([c.city, c.state].filter(Boolean).join(", "))}</span><span>${c.price_cents != null ? esc(L.money(c.price_cents / 100)) : "Price not listed"}</span></div></div>
        <div class="rc-actions"><select class="rc-select" data-status aria-label="Status" style="min-height:34px;width:auto">${["interested", "registered", "attended", "skipped"].map(s => `<option${s === sc.status ? " selected" : ""}>${s}</option>`).join("")}</select></div></div>
      <details style="margin-top:12px"><summary><b>Travel estimate:</b> <span data-total>${esc(L.money(est.total))}</span></summary>
        <p class="rc-small">Your own assumptions. Nothing here is looked up. Includes the listed camp price when there is one.</p>
        <div class="rc-est">${fld("miles_one_way", "Miles one way")}${fld("mpg", "Car MPG")}${fld("gas_price", "Gas $/gal", 0.01)}${fld("nights", "Hotel nights")}${fld("hotel_rate", "Hotel $/night")}${fld("rooms", "Rooms")}${fld("days", "Days")}${fld("people", "People eating")}${fld("meal_cost", "$ per meal")}${fld("meals_per_day", "Meals per day")}${fld("other", "Other $")}</div>
        <button class="rc-btn sm" data-savetravel style="margin-top:10px">Save estimate</button></details>
      <div class="rc-row" style="margin-top:12px">
        ${U.safeUrl(c.registration_url) ? `<a class="rc-btn sm primary" href="${esc(c.registration_url)}" target="_blank" rel="noopener">Register (official page)</a>` : ""}
        <button class="rc-btn sm" data-ics>Add to calendar</button>
        ${c.program_id ? `<a class="rc-btn sm" href="#emails?kind=event_invite&program=${esc(c.program_id)}">Invite a coach</a>` : ""}
        <button class="rc-btn sm danger" data-unsave>Remove</button>
      </div>
    </article>`;
  }
  function readTravel(card) { const t = {}; $$("[data-t]", card).forEach(i => t[i.dataset.t] = Number(i.value) || 0); t.include_registration = true; return t; }

  // ------------------------------------------------------------ PROFILE
  function renderProfile() {
    const p = S.profile, m = p.metrics || {};
    const inp = (n, l, v, type, extra) => `<label class="rc-field">${l}<input class="rc-input" name="${n}" type="${type || "text"}" value="${esc(v == null ? "" : v)}" ${extra || ""}></label>`;
    $("#tab").innerHTML = `
      <form class="rc-panel" id="prof" novalidate>
        <h2>Recruiting profile</h2>
        <p class="rc-muted">Private to you. Used to fill your email drafts and your plan. Nothing here is posted publicly.</p>
        <fieldset class="rc-fs"><legend>Player</legend><div class="rc-grid3">
          ${inp("first_name", "First name", p.first_name, "text", 'autocomplete="given-name" maxlength="60"')}${inp("last_name", "Last name", p.last_name, "text", 'autocomplete="family-name" maxlength="60"')}
          ${inp("grad_year", "Grad year", p.grad_year, "number", 'min="2024" max="2040"')}
          ${inp("primary_position", "Primary position", p.primary_position, "text", 'maxlength="20" placeholder="e.g. SS"')}${inp("secondary_position", "Second position", p.secondary_position, "text", 'maxlength="20"')}
          <div class="rc-grid2">${inp("bats", "Bats", p.bats, "text", 'maxlength="1" placeholder="R/L/S"')}${inp("throws", "Throws", p.throws, "text", 'maxlength="1" placeholder="R/L"')}</div>
          ${inp("height_in", "Height (inches)", p.height_in, "number", 'min="48" max="90"')}${inp("weight_lb", "Weight (lb)", p.weight_lb, "number", 'min="80" max="350"')}
        </div></fieldset>
        <fieldset class="rc-fs"><legend>School and team</legend><div class="rc-grid3">
          ${inp("high_school", "High school", p.high_school, "text", 'maxlength="100"')}${inp("hs_city", "City", p.hs_city, "text", 'maxlength="60"')}
          <label class="rc-field">State<select class="rc-select" name="hs_state">${U.stateOptions(p.hs_state)}</select></label>
          ${inp("club_team", "Club / travel team", p.club_team, "text", 'maxlength="100"')}${inp("club_coach", "Club coach", p.club_coach, "text", 'maxlength="80"')}
        </div></fieldset>
        <fieldset class="rc-fs"><legend>Academics</legend><div class="rc-grid3">
          ${inp("gpa", "GPA", p.gpa, "number", 'step="0.01" min="0" max="5"')}${inp("sat", "SAT", p.sat, "number", 'min="400" max="1600"')}${inp("act", "ACT", p.act, "number", 'min="1" max="36"')}
          ${inp("intended_major", "Planned major", p.intended_major, "text", 'maxlength="80"')}
        </div></fieldset>
        <fieldset class="rc-fs"><legend>Numbers <small class="rc-small">(only what you've actually measured)</small></legend><div class="rc-grid3">
          ${[["fb_velo", "Max fastball (mph)"], ["exit_velo", "Max exit velo (mph)"], ["sixty", "60-yard (sec)"], ["if_velo", "Infield velo (mph)"], ["of_velo", "Outfield velo (mph)"], ["c_velo", "Catcher velo (mph)"], ["pop", "Pop time (sec)"]].map(([k, l]) => `<label class="rc-field">${l}<input class="rc-input" type="number" step="0.01" min="0" data-m="${k}" value="${esc(m[k] == null ? "" : m[k])}"></label>`).join("")}
        </div><button class="rc-btn sm" type="button" id="fmlImport" style="margin-top:10px">Use my latest Find My Level numbers</button></fieldset>
        <fieldset class="rc-fs"><legend>Contact and links</legend><div class="rc-grid2">
          ${inp("contact_email", "Email for coaches", p.contact_email, "email", 'maxlength="120" autocomplete="email"')}${inp("phone", "Phone", p.phone, "tel", 'maxlength="30" autocomplete="tel"')}
          ${inp("video_url", "Highlight video link", p.video_url, "url", 'maxlength="300" placeholder="https://"')}${inp("profile_url", "Online profile link", p.profile_url, "url", 'maxlength="300" placeholder="https://"')}
        </div></fieldset>
        <fieldset class="rc-fs"><legend>Levels you're interested in</legend><div class="rc-row">${L.LEVELS.map(l => `<label class="rc-check"><input type="checkbox" name="lvl" value="${esc(l)}"${(p.levels_of_interest || []).includes(l) ? " checked" : ""}>${esc(l)}</label>`).join("")}</div></fieldset>
        <div class="rc-row"><button class="rc-btn primary">Save profile</button><span class="rc-small" id="profMsg" role="status"></span></div>
      </form>`;
    const f = $("#prof");
    $("#fmlImport").onclick = () => {
      let h = []; try { h = JSON.parse(localStorage.getItem("psr_fml_history_v1") || "[]"); } catch (e) {}
      const last = h[h.length - 1];
      if (!last) { U.toast("No saved Find My Level result on this device"); return; }
      const map = { maxFb: "fb_velo", maxEv: "exit_velo", sixty: "sixty", ifVelo: "if_velo", ofVelo: "of_velo", cVelo: "c_velo", pop: "pop" };
      Object.entries(map).forEach(([a, b]) => { if (last.metrics && last.metrics[a] != null) $(`[data-m="${b}"]`, f).value = last.metrics[a]; });
      if (last.gradYear && !f.grad_year.value) f.grad_year.value = last.gradYear;
      if (last.primary && !f.primary_position.value) f.primary_position.value = last.primary;
      U.toast("Numbers filled in. Review, then Save profile.");
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const bad = $$("input", f).find(i => !i.checkValidity());
      if (bad) { bad.focus(); $("#profMsg").textContent = `Check "${bad.closest("label").childNodes[0].textContent.trim()}".`; return; }
      const num = v => v === "" ? null : Number(v);
      const row = {};
      ["first_name", "last_name", "primary_position", "secondary_position", "high_school", "hs_city", "club_team", "club_coach", "intended_major", "contact_email", "phone", "video_url", "profile_url"].forEach(k => row[k] = f[k].value.trim() || null);
      row.bats = (f.bats.value.trim().toUpperCase() || null); row.throws = (f.throws.value.trim().toUpperCase() || null);
      row.hs_state = f.hs_state.value || null;
      ["grad_year", "height_in", "weight_lb", "gpa", "sat", "act"].forEach(k => row[k] = num(f[k].value));
      row.metrics = {}; $$("[data-m]", f).forEach(i => { if (i.value !== "") row.metrics[i.dataset.m] = Number(i.value); });
      row.levels_of_interest = $$("input[name=lvl]:checked", f).map(x => x.value);
      if (row.video_url && !/^https?:\/\//.test(row.video_url)) { $("#profMsg").textContent = "Video link must start with https://"; return; }
      try { S.profile = await api.saveProfile(row); $("#profMsg").textContent = "Saved."; U.toast("Profile saved"); } catch (err) { $("#profMsg").textContent = err.message; }
    };
  }

  // ------------------------------------------------------------ start
  async function start() {
    U.navInit();
    S.user = await api.getUser();
    if (!S.user) {
      $("#app").innerHTML = U.demoBanner(api) + `<div id="gate"></div>`;
      U.renderGate($("#gate"), api, { title: "Sign in to My Recruiting", text: "Free. Save schools, write coach emails, track replies and get your next steps. Your information is private to your account.", onSignedIn: start });
      return;
    }
    try { await loadAll(); } catch (e) { $("#app").innerHTML = `<div class="rc-empty">Couldn't load your workspace: ${esc(e.message)}</div>`; return; }
    shell();
  }
  window.addEventListener("hashchange", () => { if (S.user && S.profile) shell(); });
  api.onAuth(() => { if (!S.user) start(); });
  start();
})();
