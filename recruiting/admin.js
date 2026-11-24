/* Directory admin: programs, camps, rules (admin-recruiting.html). Writes are blocked by RLS for non-admins. */
(function () {
  "use strict";
  const L = window.PSRLogic, U = window.PSRUI, { esc, $, $$ } = U;
  const api = window.PSRData.init();
  const TABS = [["overview", "Overview"], ["programs", "Programs"], ["import", "Import"], ["camps", "Camps"], ["rules", "Rules"]];
  const S = { programs: [], camps: [], rules: [], q: "", status: "", level: "", page: 1 };
  const today = () => L.toISO(new Date());
  const STALE_DAYS = 45;

  function tab() { const t = location.hash.replace("#", ""); return TABS.some(x => x[0] === t) ? t : "overview"; }
  function shell() {
    const t = tab();
    $("#app").innerHTML = `${U.demoBanner(api)}
      <nav class="rc-tabs" role="tablist">${TABS.map(([k, l]) => `<a class="rc-tab" role="tab" href="#${k}" aria-selected="${k === t}">${l}</a>`).join("")}</nav><div id="tab"></div>`;
    ({ overview, programs, import: importer, camps, rules })[t]();
  }

  async function overview() {
    let st = null; try { st = await api.adminStats(); } catch (e) {}
    const rq = S.programs.filter(p => p.record_status === "needs_review");
    const staleCamps = S.camps.filter(c => (c.end_date || c.start_date) >= today() && L.isStale(c, today(), STALE_DAYS));
    const pastCamps = S.camps.filter(c => (c.end_date || c.start_date) < today());
    const staleRules = S.rules.filter(r => r.record_status === "needs_review" || L.isStale(r, today(), 180));
    const noAcad = S.programs.filter(p => p.avg_net_price == null && p.admission_rate == null).length;
    $("#tab").innerHTML = `
      ${st ? `<div class="rc-stats">${[["accounts", "Player accounts"], ["saved_schools", "Schools saved"], ["messages_logged", "Messages logged"], ["saved_camps", "Camps saved"], ["programs", "Programs"], ["programs_verified", "Programs checked"], ["camps_upcoming", "Upcoming camps"]].map(([k, l]) => `<div class="rc-stat"><b>${esc(st[k] ?? 0)}</b><span>${l}</span></div>`).join("")}</div>
        <p class="rc-small">Totals only. Players' private data isn't visible to admins.</p>` : ""}
      <section class="rc-panel"><h3>Review queue</h3>
        <ul style="padding-left:18px;margin:0">
          <li><a class="rc-link" href="#programs" data-qs="needs_review">${rq.length} programs need review</a> (closures, mergers, unclear associations)</li>
          <li>${S.programs.filter(p => p.record_status === "unverified").length.toLocaleString()} programs are listing-only. Open the official athletics page, add links, and mark them checked.</li>
          <li>${noAcad.toLocaleString()} programs have no academic or cost data. Use Import with a College Scorecard export.</li>
          <li><a class="rc-link" href="#camps">${staleCamps.length} upcoming camps not checked in ${STALE_DAYS}+ days</a> · ${pastCamps.length} past camps (hidden from players)</li>
          <li><a class="rc-link" href="#rules">${staleRules.length} rules need review or a fresh check</a></li>
        </ul></section>`;
    $$("[data-qs]").forEach(a => a.onclick = () => { S.status = a.dataset.qs; });
  }

  // ------------------------------------------------------------ programs
  function programs() {
    const list = S.programs.filter(p => (!S.status || p.record_status === S.status) && (!S.level || p.level === S.level) && (!S.q || (p.name + " " + (p.state || "")).toLowerCase().includes(S.q.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
    const per = 30, pages = Math.max(1, Math.ceil(list.length / per)); S.page = Math.min(S.page, pages);
    $("#tab").innerHTML = `
      <div class="rc-row" style="margin-bottom:12px">
        <input class="rc-input" style="max-width:280px" id="aq" type="search" placeholder="Search name or state" value="${esc(S.q)}">
        <select class="rc-select" style="width:auto" id="as"><option value="">Any status</option>${["unverified", "verified", "needs_review", "hidden"].map(s => `<option value="${s}"${s === S.status ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>`).join("")}</select>
        <select class="rc-select" style="width:auto" id="al"><option value="">Any level</option>${L.LEVELS.map(l => `<option value="${l}"${l === S.level ? " selected" : ""}>${l[0].toUpperCase() + l.slice(1).replace(/_/g, " ")}</option>`).join("")}</select>
        <button class="rc-btn primary" id="addP">Add program</button><button class="rc-btn" id="expP">Export CSV</button>
      </div>
      <p class="rc-small">${list.length.toLocaleString()} programs</p>
      <div class="rc-scroll"><table class="rc-table"><thead><tr><th>Program</th><th>Level</th><th>State</th><th>Status</th><th>Checked</th><th></th></tr></thead><tbody>
        ${list.slice((S.page - 1) * per, S.page * per).map(p => `<tr><td><b>${esc(p.name)}</b>${p.review_note ? `<br><span class="rc-small">${esc(p.review_note)}</span>` : ""}</td><td>${esc(p.level)}</td><td>${esc(p.state || "")}</td><td>${esc(p.record_status)}</td><td>${esc(p.last_checked || "")}</td><td><button class="rc-btn sm" data-editp="${esc(p.id)}">Edit</button></td></tr>`).join("")}
      </tbody></table></div>
      <nav class="rc-pager"><button class="rc-btn sm" id="pp"${S.page === 1 ? " disabled" : ""}>Previous</button><span class="rc-small">Page ${S.page} of ${pages}</span><button class="rc-btn sm" id="pn"${S.page === pages ? " disabled" : ""}>Next</button></nav>`;
    let t; $("#aq").oninput = e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value; S.page = 1; programs(); $("#aq").focus(); }, 200); };
    $("#as").onchange = e => { S.status = e.target.value; S.page = 1; programs(); };
    $("#al").onchange = e => { S.level = e.target.value; S.page = 1; programs(); };
    $("#pp").onclick = () => { S.page--; programs(); }; $("#pn").onclick = () => { S.page++; programs(); };
    $("#addP").onclick = () => editProgram({ level: "NCAA D1", association: "NCAA", record_status: "unverified" });
    $("#expP").onclick = () => U.download("programs.csv", toCSV(list, L.PROGRAM_FIELDS), "text/csv");
    $$("[data-editp]").forEach(b => b.onclick = () => editProgram(S.programs.find(p => p.id === b.dataset.editp)));
  }
  function toCSV(rows, cols) {
    const q = v => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    return cols.join(",") + "\n" + rows.map(r => cols.map(c => q(r[c])).join(",")).join("\n") + "\n";
  }
  function editProgram(p) {
    const f = (k, l, type, extra) => `<label class="rc-field">${l}<input class="rc-input" name="${k}" type="${type || "text"}" value="${esc(p[k] == null ? "" : p[k])}" ${extra || ""}></label>`;
    U.openDialog(`<form id="pf" novalidate><h2>${p.id ? "Edit program" : "Add program"}</h2>
      <div class="rc-grid2">${f("name", "Name", "text", "required")}${f("slug", "Slug (URL id)")}
        <label class="rc-field">Level<select class="rc-select" name="level">${L.LEVELS.map(l => `<option value="${l}"${l === p.level ? " selected" : ""}>${l[0].toUpperCase() + l.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>
        <label class="rc-field">Association<select class="rc-select" name="association">${["NCAA", "NAIA", "NJCAA", "CCCAA", "NWAC", "Other"].map(l => `<option value="${l}"${l === p.association ? " selected" : ""}>${l[0].toUpperCase() + l.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>
        ${f("conference", "Conference")}${f("city", "City")}<label class="rc-field">State<select class="rc-select" name="state">${U.stateOptions(p.state)}</select></label></div>
      <h3 style="margin:16px 0 8px">Official links</h3><div class="rc-grid2">${f("athletics_url", "Athletics site", "url")}${f("roster_url", "Roster", "url")}${f("schedule_url", "Schedule", "url")}${f("camps_url", "Camps page", "url")}${f("questionnaire_url", "Recruiting questionnaire", "url")}${f("staff_url", "Baseball staff page", "url")}${f("majors_url", "Majors / academic catalog", "url")}${f("website_url", "School website", "url")}</div>
      <h3 style="margin:16px 0 8px">Academics and cost <small class="rc-small">(College Scorecard)</small></h3><div class="rc-grid3">${f("undergrad_enrollment", "Undergrads", "number")}${f("admission_rate", "Admission rate (0-1)", "number", 'step="0.0001" min="0" max="1"')}${f("grad_rate", "Grad rate (0-1)", "number", 'step="0.0001" min="0" max="1"')}${f("sat_25", "SAT 25th", "number")}${f("sat_75", "SAT 75th", "number")}${f("act_25", "ACT 25th", "number")}${f("act_75", "ACT 75th", "number")}${f("tuition_in_state", "Tuition in-state $", "number")}${f("tuition_out_state", "Tuition out-of-state $", "number")}${f("avg_net_price", "Avg net price $", "number")}${f("academic_year", "Reporting year", "text", 'placeholder="e.g. 2022-23"')}${f("academic_source_url", "Source URL", "url")}</div>
      <h3 style="margin:16px 0 8px">Review</h3><div class="rc-grid2"><label class="rc-field">Status<select class="rc-select" name="record_status">${["unverified", "verified", "needs_review", "hidden"].map(s => `<option value="${s}"${s === p.record_status ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>${f("last_checked", "Last checked", "date")}</div>
      ${f("review_note", "Review note")}
      <p class="rc-small" id="pfMsg" role="status"></p>
      <div class="rc-dlg-actions"><button class="rc-btn" type="button" id="chk">Mark checked today</button><button class="rc-btn" type="button" id="cx">Cancel</button><button class="rc-btn primary">Save</button></div></form>`, d => {
      const form = $("#pf", d);
      $("#cx", d).onclick = () => d.close();
      $("#chk", d).onclick = () => { form.elements.namedItem("last_checked").value = today(); form.elements.namedItem("record_status").value = "verified"; };
      form.onsubmit = async e => {
        e.preventDefault();
        const raw = {}; L.PROGRAM_FIELDS.forEach(k => { if (form.elements.namedItem(k)) raw[k] = form.elements.namedItem(k).value; });
        const { row, errors } = L.normalizeProgramRow(raw);
        if (row.record_status === "verified" && !row.athletics_url && !row.roster_url) errors.push("A checked program needs at least one official link");
        if (row.record_status === "verified" && !row.last_checked) errors.push("A checked program needs a last-checked date");
        if (errors.length) { $("#pfMsg", d).textContent = errors.join(". "); return; }
        try { const saved = await api.adminSaveProgram(Object.assign({ id: p.id }, row)); await reload(); d.close(); U.toast("Saved " + (saved && saved.name || "")); shell(); }
        catch (err) { $("#pfMsg", d).textContent = err.message; }
      };
    });
  }

  // ------------------------------------------------------------ import
  function importer() {
    $("#tab").innerHTML = `<section class="rc-panel"><h3>Import programs from CSV</h3>
      <p class="rc-small">Columns (header row, any order): ${esc(L.PROGRAM_FIELDS.join(", "))}. Only <b>name</b> and <b>level</b> are required. Rows match existing programs by <b>slug</b> (made from the name if blank) and update only the columns you include. Academic and cost columns require <b>academic_year</b> and <b>academic_source_url</b>. To add College Scorecard data, export the columns you need, rename them to these headers, and include the reporting year.</p>
      <input type="file" accept=".csv,text/csv" id="csv" class="rc-input">
      <div id="prev" style="margin-top:14px"></div></section>`;
    $("#csv").onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      let rows; try { rows = L.parseCSV(await file.text()); } catch (error) { $("#prev").textContent = error.message; return; }
      const parsed = rows.map((r, i) => Object.assign({ line: i + 2 }, L.normalizeProgramRow(r)));
      const ok = parsed.filter(p => !p.errors.length), bad = parsed.filter(p => p.errors.length);
      const existing = new Set(S.programs.map(p => p.slug));
      $("#prev").innerHTML = `<p><b>${ok.length}</b> rows ready (${ok.filter(p => existing.has(p.row.slug)).length} update, ${ok.filter(p => !existing.has(p.row.slug)).length} new) · <b>${bad.length}</b> with errors</p>
        ${bad.length ? `<div class="rc-scroll"><table class="rc-table"><thead><tr><th>Line</th><th>Name</th><th>Problem</th></tr></thead><tbody>${bad.slice(0, 50).map(b => `<tr><td>${b.line}</td><td>${esc(b.row.name || "")}</td><td>${esc(b.errors.join("; "))}</td></tr>`).join("")}</tbody></table></div>` : ""}
        ${ok.length ? `<button class="rc-btn primary" id="go" style="margin-top:12px">Import ${ok.length} rows</button>` : ""}`;
      if ($("#go")) $("#go").onclick = async () => {
        try { $("#go").disabled = true; const n = await api.adminImportPrograms(ok.map(o => o.row)); await reload(); U.toast(`Imported ${n} rows`); location.hash = "#programs"; }
        catch (err) { U.toast("Import stopped: " + err.message + ". Earlier rows may have saved; fix and retry by slug."); if ($("#go")) $("#go").disabled = false; }
      };
    };
  }

  // ------------------------------------------------------------ camps
  function camps() {
    const list = S.camps.slice().sort((a, b) => b.start_date.localeCompare(a.start_date));
    $("#tab").innerHTML = `<div class="rc-row" style="margin-bottom:12px"><button class="rc-btn primary" id="addC">Add camp</button><span class="rc-small">Past camps are hidden from players automatically. Flagged = not checked in ${STALE_DAYS}+ days.</span></div>
      <div class="rc-scroll"><table class="rc-table"><thead><tr><th>Date</th><th>Camp</th><th>Place</th><th>Status</th><th>Checked</th><th></th></tr></thead><tbody>
      ${list.map(c => { const past = (c.end_date || c.start_date) < today(); const stale = !past && L.isStale(c, today(), STALE_DAYS); return `<tr><td>${esc(c.start_date)}</td><td><b>${esc(c.title)}</b><br><span class="rc-small">${esc(c.program_name || c.host_name || "")}</span></td><td>${esc([c.city, c.state].filter(Boolean).join(", "))}</td><td>${past ? '<span class="rc-badge">Past</span>' : stale ? '<span class="rc-badge warn">Recheck</span>' : `<span class="rc-badge ok">${esc(c.record_status)}</span>`}</td><td>${esc(c.last_checked || "")}</td><td class="rc-row"><button class="rc-btn sm" data-editc="${esc(c.id)}">Edit</button><button class="rc-btn sm" data-dupc="${esc(c.id)}">Copy</button></td></tr>`; }).join("") || `<tr><td colspan="6">No camps yet.</td></tr>`}
      </tbody></table></div>`;
    $("#addC").onclick = () => editCamp({ camp_type: "prospect_camp", record_status: "verified", last_checked: today(), grad_years: [] });
    $$("[data-editc]").forEach(b => b.onclick = () => editCamp(S.camps.find(c => c.id === b.dataset.editc)));
    $$("[data-dupc]").forEach(b => b.onclick = () => { const c = Object.assign({}, S.camps.find(x => x.id === b.dataset.dupc)); delete c.id; c.title += " (copy)"; editCamp(c); });
  }
  function editCamp(c) {
    const f = (k, l, type, extra) => `<label class="rc-field">${l}<input class="rc-input" name="${k}" type="${type || "text"}" value="${esc(c[k] == null ? "" : c[k])}" ${extra || ""}></label>`;
    const progOpts = S.programs.filter(p => p.record_status !== "hidden").sort((a, b) => a.name.localeCompare(b.name));
    U.openDialog(`<form id="cf" novalidate><h2>${c.id ? "Edit camp" : "Add camp"}</h2>
      <p class="rc-small" style="margin-top:0">Only enter details shown on the official school or registration page. Leave anything not listed blank.</p>
      <div class="rc-grid2">${f("title", "Camp name", "text", "required")}${f("host_name", "Host")}
        <label class="rc-field">School <small>(optional)</small><input class="rc-input" name="program" list="progList" value="${esc((S.programs.find(p => p.id === c.program_id) || {}).name || "")}"><datalist id="progList">${progOpts.map(p => `<option value="${esc(p.name)}">`).join("")}</datalist></label>
        <label class="rc-field">Type<select class="rc-select" name="camp_type">${["camp", "prospect_camp", "showcase", "clinic", "id_camp"].map(t => `<option value="${t}"${t === c.camp_type ? " selected" : ""}>${t[0].toUpperCase() + t.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>
        ${f("start_date", "Start date", "date", "required")}${f("end_date", "End date", "date")}${f("time_note", "Time")}${f("venue", "Venue")}${f("city", "City")}<label class="rc-field">State<select class="rc-select" name="state">${U.stateOptions(c.state)}</select></label>
        ${f("price", "Price ($)", "number", `step="0.01" min="0" value="${c.price_cents != null ? c.price_cents / 100 : ""}"`)}${f("price_note", "Price note")}
        ${f("grad_years_txt", "Eligible grad years (comma list)", "text", `value="${esc((c.grad_years || []).join(", "))}"`)}${f("eligibility_note", "Eligibility note")}${f("positions", "Positions")}${f("confirmed_coaches", "Coaches named on the official page")}</div>
      <div class="rc-grid2" style="margin-top:8px">${f("registration_url", "Registration URL", "url")}${f("source_url", "Official source URL", "url", "required")}
        <label class="rc-field">Status<select class="rc-select" name="record_status">${["verified", "needs_review", "hidden"].map(s => `<option value="${s}"${s === c.record_status ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>${f("last_checked", "Last checked", "date", "required")}</div>
      <p class="rc-small" id="cfMsg" role="status"></p>
      <div class="rc-dlg-actions">${c.id ? `<button class="rc-btn danger" type="button" id="delC">Delete</button>` : ""}<button class="rc-btn" type="button" id="chkC">Checked today</button><button class="rc-btn" type="button" id="cxC">Cancel</button><button class="rc-btn primary">Save</button></div></form>`, d => {
      const form = $("#cf", d);
      // price/grad years inputs were rendered with an extra value attr; normalize
      form.elements.namedItem("price").value = c.price_cents != null ? c.price_cents / 100 : ""; form.elements.namedItem("grad_years_txt").value = (c.grad_years || []).join(", ");
      $("#cxC", d).onclick = () => d.close();
      $("#chkC", d).onclick = () => { form.elements.namedItem("last_checked").value = today(); };
      if ($("#delC", d)) $("#delC", d).onclick = async () => { if (!(await U.confirmDialog("Delete this camp? Players who saved it will lose it."))) return; await api.adminDeleteCamp(c.id); await reload(); d.close(); shell(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const err = [];
        const v = k => form.elements.namedItem(k).value.trim();
        if (!v("title")) err.push("Camp name is required");
        if (!L.parseISO(v("start_date"))) err.push("Start date is required");
        if (v("end_date") && v("end_date") < v("start_date")) err.push("End date is before start date");
        if (!U.safeUrl(v("source_url"))) err.push("Official source URL is required");
        if (v("registration_url") && !U.safeUrl(v("registration_url"))) err.push("Registration URL must start with http(s)://");
        const years = v("grad_years_txt") ? v("grad_years_txt").split(/[,\s]+/).filter(Boolean).map(Number) : [];
        if (years.some(y => !Number.isInteger(y) || !(y >= 2024 && y <= 2040))) err.push("Grad years must be like 2027, 2028");
        const matches = S.programs.filter(p => p.name === v("program"));
        const prog = matches.length === 1 ? matches[0] : null;
        if (matches.length > 1) err.push("School name is ambiguous; edit the program names to distinguish campuses first");
        if (v("price") && (!Number.isFinite(Number(v("price"))) || Number(v("price")) < 0)) err.push("Price must be nonnegative");
        if (v("last_checked") && !L.parseISO(v("last_checked"))) err.push("Invalid checked date");
        if (v("program") && !prog) err.push("Pick the school from the list, or leave it blank");
        if (err.length) { $("#cfMsg", d).textContent = err.join(". "); return; }
        const row = { id: c.id, program_id: prog ? prog.id : null, title: v("title"), host_name: v("host_name") || null, camp_type: form.elements.namedItem("camp_type").value, start_date: v("start_date"), end_date: v("end_date") || null, time_note: v("time_note") || null, venue: v("venue") || null, city: v("city") || null, state: form.elements.namedItem("state").value || null, price_cents: v("price") === "" ? null : Math.round(Number(v("price")) * 100), price_note: v("price_note") || null, grad_years: years, eligibility_note: v("eligibility_note") || null, positions: v("positions") || null, confirmed_coaches: v("confirmed_coaches") || null, registration_url: v("registration_url") || null, source_url: v("source_url"), record_status: form.elements.namedItem("record_status").value, last_checked: v("last_checked") || today() };
        try { await api.adminSaveCamp(row); await reload(); d.close(); U.toast("Camp saved"); shell(); } catch (er) { $("#cfMsg", d).textContent = er.message; }
      };
    });
  }

  // ------------------------------------------------------------ rules
  function rules() {
    $("#tab").innerHTML = `<p class="rc-small">Rules feed the plan's key dates and links. Each needs an official source and a last-checked date. Rules marked needs_review are kept off public pages until rechecked.</p>
      <div class="rc-list">${S.rules.map(r => `<article class="rc-panel" style="margin:0"><div class="rc-spread"><div><b>${esc(r.level)} · ${esc(r.topic)}</b> <span class="rc-small">(${esc(r.rule_key || "")})</span></div><div class="rc-row">${r.record_status === "verified" && !L.isStale(r, today(), 180) ? `<span class="rc-badge ok">Checked ${esc(r.last_checked)}</span>` : `<span class="rc-badge warn">${esc(r.record_status === "verified" ? "Recheck" : r.record_status)}</span>`}<button class="rc-btn sm" data-editr="${esc(r.id)}">Edit</button></div></div>
        <p style="margin:8px 0 4px">${esc(r.summary)}</p><p class="rc-small" style="margin:0">${esc(r.source_name)} · <a class="rc-link" href="${esc(U.safeUrl(r.source_url))}" target="_blank" rel="noopener">${esc(U.host(r.source_url))}</a></p></article>`).join("")}</div>
      <button class="rc-btn primary" id="addR" style="margin-top:12px">Add rule</button>`;
    $$("[data-editr]").forEach(b => b.onclick = () => editRule(S.rules.find(r => r.id === b.dataset.editr)));
    $("#addR").onclick = () => editRule({ record_status: "needs_review" });
  }
  function editRule(r) {
    const f = (k, l, type) => `<label class="rc-field">${l}<input class="rc-input" name="${k}" type="${type || "text"}" value="${esc(r[k] == null ? "" : r[k])}"></label>`;
    U.openDialog(`<form id="rf"><h2>${r.id ? "Edit rule" : "Add rule"}</h2><div class="rc-grid2">${f("rule_key", "Key")}${f("level", "Level")}${f("topic", "Topic")}${f("applies_when", "When it applies")}</div>
      <label class="rc-field" style="margin-top:8px">Summary<textarea class="rc-textarea" style="min-height:90px" name="summary">${esc(r.summary || "")}</textarea></label>
      <div class="rc-grid2" style="margin-top:8px">${f("source_name", "Official source name")}${f("source_url", "Official source URL", "url")}<label class="rc-field">Status<select class="rc-select" name="record_status">${["verified", "needs_review", "hidden"].map(s => `<option value="${s}"${s === r.record_status ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1).replace(/_/g, " ")}</option>`).join("")}</select></label>${f("last_checked", "Last checked", "date")}</div>
      <p class="rc-small" id="rfMsg"></p><div class="rc-dlg-actions"><button class="rc-btn" type="button" id="cxR">Cancel</button><button class="rc-btn primary">Save</button></div></form>`, d => {
      const form = $("#rf", d); $("#cxR", d).onclick = () => d.close();
      form.onsubmit = async e => {
        e.preventDefault();
        const row = { id: r.id }; ["rule_key", "level", "topic", "applies_when", "summary", "source_name", "source_url", "record_status", "last_checked"].forEach(k => row[k] = form.elements.namedItem(k).value.trim() || null);
        if (!row.rule_key || !row.level || !row.summary || !row.source_name || !/^https?:\/\//.test(row.source_url || "")) { $("#rfMsg", d).textContent = "Key, level, summary, source name and an http(s) source URL are required."; return; }
        try { await api.adminSaveRule(row); await reload(); d.close(); shell(); } catch (er) { $("#rfMsg", d).textContent = er.message; }
      };
    });
  }

  async function reload() {
    const [p, c, r] = await Promise.all([api.listProgramsAdmin(), api.listCamps(), api.listRules()]);
    Object.assign(S, { programs: p, camps: c, rules: r });
  }
  async function start() {
    U.navInit();
    try {
    const user = await api.getUser();
    if (!user) { $("#app").innerHTML = U.demoBanner(api) + `<div id="gate"></div>`; U.renderGate($("#gate"), api, { title: "Owner sign in", text: "Sign in with the owner email.", onSignedIn: start }); return; }
    if (!(await api.isAdmin())) { $("#app").innerHTML = U.demoBanner(api) + `<div class="rc-empty">This account isn't an admin. <button class="rc-link" id="so">Sign out</button></div>`; $("#so").onclick = async () => { await api.signOut(); start(); }; return; }
    await reload(); shell();
    } catch (error) { $("#app").innerHTML = `<div class="rc-empty">Admin workspace could not load: ${esc(error.message)}. Reload to retry.</div>`; }
  }
  api.onAuth(start);
  window.addEventListener("hashchange", () => { if ($("#tab")) shell(); });
  start();
})();
