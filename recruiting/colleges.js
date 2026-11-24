/* College Finder + school detail + saved schools (colleges.html) */
(function () {
  "use strict";
  const L = window.PSRLogic, U = window.PSRUI, { esc, $, $$ } = U;
  const api = window.PSRData.init();
  const PAGE = 25;
  let programs = [], user = null, saved = new Map(), page = 1, nextCamp = new Map();
  const state = { q: "", bands: [], states: [], conference: "", verifiedOnly: false, maxNetPrice: "", hasAcademics: false, sort: "name", fromFml: false };

  function readQuery() {
    const p = new URLSearchParams(location.search);
    if (p.get("q")) state.q = p.get("q");
    if (p.get("bands")) state.bands = p.get("bands").split(",").filter(b => L.BANDS.includes(b));
    else if (p.get("levels")) state.bands = L.bandsFromLevels(p.get("levels").split(","));
    if (p.get("state")) state.states = [p.get("state")];
    if (p.get("verified") === "1") state.verifiedOnly = true;
    state.maxNetPrice = p.get("budget") || "";
    state.hasAcademics = p.get("academics") === "1";
    state.conference = p.get("conference") || "";
    state.sort = ["name", "state", "level", "price"].includes(p.get("sort")) ? p.get("sort") : "name";
    state.fromFml = p.get("from") === "fml";
  }
  function writeQuery() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.maxNetPrice !== "") p.set("budget", state.maxNetPrice);
    if (state.hasAcademics) p.set("academics", "1");
    if (state.conference) p.set("conference", state.conference);
    if (state.sort !== "name") p.set("sort", state.sort);
    if (state.bands.length) p.set("bands", state.bands.join(","));
    if (state.states.length) p.set("state", state.states[0]);
    if (state.verifiedOnly) p.set("verified", "1");
    if (state.fromFml) p.set("from", "fml");
    if (new URLSearchParams(location.search).get("demo") === "1") p.set("demo", "1");
    const qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  async function refreshSaved() {
    user = await api.getUser();
    saved = new Map();
    if (user) (await api.table("saved_schools").list()).forEach(s => saved.set(s.program_id, s));
  }

  function filtersHtml() {
    const confs = [...new Set(programs.filter(p => !state.bands.length || state.bands.includes(L.bandOf(p))).map(p => p.conference).filter(Boolean))].sort();
    const coverage = window.PSRRoadmap.coverage(programs);
    return `
      <form class="rc-panel rc-filters" id="filters" aria-label="Filters">
        <label class="rc-field">Search<input class="rc-input" id="fQ" type="search" placeholder="School, city or conference" value="${esc(state.q)}"></label>
        <fieldset class="rc-fs" style="margin-top:14px"><legend>Level</legend><div class="rc-checks">
          ${L.BANDS.map(b => `<label class="rc-check"><input type="checkbox" name="lvl" value="${b}"${state.bands.includes(b) ? " checked" : ""}>${esc(L.BAND_LABELS[b])} <span class="rc-small">(${programs.filter(p => L.bandOf(p) === b).length})</span></label>`).join("")}
          <small class="rc-small" style="grid-column:1/-1">D1 groups are based on each conference's typical strength in baseball. Every program is different.</small>
        </div></fieldset>
        <label class="rc-field">State<select class="rc-select" id="fState">${U.stateOptions(state.states[0])}</select></label>
        <label class="rc-field" style="margin-top:12px">Conference<select class="rc-select" id="fConf"><option value="">Any conference</option>${confs.map(c => `<option${c === state.conference ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label class="rc-field" style="margin-top:12px">Max average net price ($/year)<input class="rc-input" type="number" id="fBudget" min="0" value="${esc(state.maxNetPrice)}"${!coverage.cost && state.maxNetPrice === '' ? ' disabled' : ''}><small>${coverage.cost ? 'Only includes schools with sourced cost data.' : 'No source-labeled average net prices loaded yet.'} Average net price is not your financial aid offer.</small></label>
        <label class="rc-check" style="margin-top:12px"><input type="checkbox" id="fAcad"${state.hasAcademics ? " checked" : ""}>Only schools with loaded academic or cost data</label>
        <p class="rc-small">${coverage.academics.toLocaleString()} schools currently have source-labeled academic or cost data. <a class="rc-link" href="recruiting-roadmap.html#cost">Compare your own college costs</a>.</p>
        <label class="rc-check" style="margin-top:12px"><input type="checkbox" id="fVer"${state.verifiedOnly ? " checked" : ""}>Only schools with an official athletics site</label>
        <label class="rc-field" style="margin-top:12px">Sort<select class="rc-select" id="fSort">
          <option value="name"${state.sort === "name" ? " selected" : ""}>Name</option>
          <option value="state"${state.sort === "state" ? " selected" : ""}>State</option>
          <option value="level"${state.sort === "level" ? " selected" : ""}>Level</option>
          <option value="price"${state.sort === "price" ? " selected" : ""}>Lowest net price</option></select></label>
        <button class="rc-btn" type="button" id="fClear" style="margin-top:14px;width:100%">Clear filters</button>
      </form>
      <div class="rc-panel">
        <h3>About this directory</h3>
        <p class="rc-small" style="margin:0">Schools come from public listings of college baseball programs. An "Official site" badge means the listing links to the school's official athletics website. Academic and cost figures come from the U.S. Department of Education College Scorecard and show their reporting year. Blank means not loaded yet. We never list coach contacts, roster openings, scholarships or admission chances.</p>
      </div>`;
  }

  // Up to three College Scorecard numbers. Missing values are skipped, never shown as blanks.
  function cardStats(p) {
    const st = [];
    if (p.undergrad_enrollment != null) st.push([Number(p.undergrad_enrollment).toLocaleString("en-US"), "Undergrads"]);
    if (p.avg_net_price != null) st.push([L.money(Math.round(p.avg_net_price / 100) * 100), "Avg net price / yr"]);
    if (p.grad_rate != null) st.push([Math.round(p.grad_rate * 100) + "%", "Graduate in 6 yrs"]);
    else if (p.admission_rate != null) st.push([Math.round(p.admission_rate * 100) + "%", "Admit rate"]);
    return st.length ? `<dl class="rc-card-stats">${st.map(([v, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
  }

  // Saved schools draft inside My Recruiting so the email is tracked; others open Email Coach with the school picked.
  function emailHref(p) {
    return saved.get(p.id) ? `my-recruiting.html#emails?kind=introduction&program=${encodeURIComponent(p.id)}` : `email-coach.html?school=${encodeURIComponent(p.slug)}`;
  }

  function nextCampHtml(p) {
    const c = nextCamp.get(p.id);
    if (!c) return "";
    const when = L.fmtDate(c.start_date, { month: "short", day: "numeric" });
    return `<a class="rc-nextcamp" href="camps.html?q=${encodeURIComponent(p.name)}">Next camp ${esc(when)}</a>`;
  }

  function cardHtml(p) {
    const s = saved.get(p.id);
    return `<article class="rc-card">
      <div>
        <h3><a href="#school=${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3>
        <div class="rc-meta">${U.levelBadge(p.level === "NCAA D1" ? L.BAND_LABELS[L.bandOf(p)] : p.level)}${p.conference ? `<span>${esc(p.conference)}</span>` : ""}<span>${esc([p.city, p.state].filter(Boolean).join(", "))}</span>${U.statusBadge(p)}</div>
        ${cardStats(p)}
        ${nextCampHtml(p)}
      </div>
      <div class="rc-actions">
        <a class="rc-btn sm" href="#school=${encodeURIComponent(p.slug)}">Details</a>
        <a class="rc-btn sm" href="${emailHref(p)}">Email coach</a>
        <button class="rc-btn sm${s ? " dark" : ""}" data-save="${esc(p.id)}" aria-pressed="${s ? "true" : "false"}">${s ? "Saved" : "Save"}</button>
      </div>
    </article>`;
  }

  function renderList() {
    const res = L.filterPrograms(programs, Object.assign({}, state, { verifiedOnly: false }))
      .filter(p => !state.verifiedOnly || U.safeUrl(p.athletics_url));
    const pages = Math.max(1, Math.ceil(res.length / PAGE));
    page = Math.min(page, pages);
    const slice = res.slice((page - 1) * PAGE, page * PAGE);
    $("#results").innerHTML = `
      <div class="rc-results-head">
        <p style="margin:0"><b>${res.length.toLocaleString()}</b> program${res.length === 1 ? "" : "s"}${state.bands.length ? ` at ${esc(state.bands.map(b => L.BAND_LABELS[b]).join(", "))}` : ""}</p>
        <div class="rc-row"><button class="rc-btn sm rc-filters-toggle" id="toggleFilters" type="button" aria-expanded="false">Filters</button>${user ? `<a class="rc-btn sm" href="my-recruiting.html#saved">My saved schools (${saved.size})</a>` : ""}</div>
      </div>
      ${state.fromFml && state.bands.length ? `<p class="rc-note">Showing the levels from your Find My Level comparison. These are levels to explore, not a judgment about any specific program. Every school decides on its own.</p>` : ""}
      <div class="rc-list">${slice.map(cardHtml).join("") || `<div class="rc-empty">No programs match. Try fewer filters.</div>`}</div>
      ${pages > 1 ? `<nav class="rc-pager" aria-label="Pages"><button class="rc-btn sm" id="prev"${page === 1 ? " disabled" : ""}>Previous</button><span class="rc-small">Page ${page} of ${pages}</span><button class="rc-btn sm" id="next"${page === pages ? " disabled" : ""}>Next</button></nav>` : ""}`;
    const go = d => { page += d; renderList(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); };
    if ($("#prev")) $("#prev").onclick = () => go(-1);
    if ($("#next")) $("#next").onclick = () => go(1);
    $("#toggleFilters").onclick = e => { const f = $("#filters"); f.classList.toggle("collapsed"); e.target.setAttribute("aria-expanded", String(!f.classList.contains("collapsed"))); };
  }

  function bindFilters() {
    const f = $("#filters");
    if (window.matchMedia("(max-width:900px)").matches) f.classList.add("collapsed");
    const upd = () => { page = 1; writeQuery(); renderList(); };
    let t; $("#fQ").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; upd(); }, 150); });
    $$("input[name=lvl]", f).forEach(cb => cb.addEventListener("change", () => { state.bands = $$("input[name=lvl]:checked", f).map(x => x.value); state.conference = ""; renderAll(); }));
    $("#fState").onchange = e => { state.states = e.target.value ? [e.target.value] : []; upd(); };
    $("#fConf").onchange = e => { state.conference = e.target.value; upd(); };
    $("#fBudget").oninput = e => { state.maxNetPrice = e.target.value; upd(); };
    $("#fAcad").onchange = e => { state.hasAcademics = e.target.checked; upd(); };
    $("#fVer").onchange = e => { state.verifiedOnly = e.target.checked; upd(); };
    $("#fSort").onchange = e => { state.sort = e.target.value; upd(); };
    $("#fClear").onclick = () => { Object.assign(state, { q: "", bands: [], states: [], conference: "", verifiedOnly: false, maxNetPrice: "", hasAcademics: false, sort: "name", fromFml: false }); renderAll(); };
    f.addEventListener("submit", e => e.preventDefault());
  }

  function renderAll() {
    $("#side").innerHTML = filtersHtml();
    bindFilters(); writeQuery(); renderList();
  }

  // ------------------------------------------------------------ detail
  function money(v) { return v == null ? null : L.money(v); }
  function pct(v) { return v == null ? null : Math.round(v * 100) + "%"; }
  function range(a, b) { return a == null && b == null ? null : `${a ?? "?"}–${b ?? "?"}`; }

  function detailHtml(p) {
    const s = saved.get(p.id);
    // Only link an athletics site we've confirmed. No search-engine links anywhere: every link goes
    // straight to an official page.
    const siteOk = U.safeUrl(p.athletics_url) && !/not opened yet/i.test(p.review_note || "");
    const athUrl = siteOk ? p.athletics_url : null;
    const links = [["Athletics site", athUrl], ["Baseball roster", p.roster_url], ["Schedule", p.schedule_url], ["Camps page", p.camps_url], ["Recruiting questionnaire", p.questionnaire_url], ["Baseball staff", p.staff_url], ["Majors / academic catalog", p.majors_url], ["School website", p.website_url]].filter(x => U.safeUrl(x[1]));
    // For any key page we haven't recorded, offer a one-tap link that opens the top search result for it.
    const site = siteOk ? U.host(p.athletics_url) : "";
    // PrestoSports sites all use the same baseball paths, so those pages can be linked directly.
    const presto = /\.prestosports\.com$/i.test(site) ? "https://" + site + "/sports/bsb/" : "";
    const quick = [["Baseball roster", p.roster_url, "roster"], ["Baseball coaches", p.staff_url, "coaches"], ["Baseball schedule", p.schedule_url, "schedule"]]
      .filter(x => presto && !U.safeUrl(x[1])).map(([l, , path]) => [l, presto + path]);
    const missing = ["roster", "coaches", "recruiting questionnaire", "camps"].filter((_, i) => !U.safeUrl([p.roster_url, p.staff_url, p.questionnaire_url, p.camps_url][i]));
    const home = siteOk ? p.athletics_url : (U.safeUrl(p.website_url) ? p.website_url : null);
    const acad = [["Undergraduates", p.undergrad_enrollment != null ? Number(p.undergrad_enrollment).toLocaleString() : null], ["Admission rate", pct(p.admission_rate)], ["SAT (middle 50%)", range(p.sat_25, p.sat_75)], ["ACT (middle 50%)", range(p.act_25, p.act_75)], ["Graduation rate", pct(p.grad_rate)], ["Tuition, in-state", money(p.tuition_in_state)], ["Tuition, out-of-state", money(p.tuition_out_state)], ["Average net price", money(p.avg_net_price)]];
    const hasAcad = acad.some(a => a[1] != null);
    return `
      <p><a class="rc-link" href="#" id="back">Back to all schools</a></p>
      <div class="rc-cols rc-cols-side" style="--rc-side:320px">
        <div>
          <section class="rc-panel">
            <div class="rc-spread"><div class="rc-meta" style="margin:0">${U.levelBadge(p.level === "NCAA D1" ? L.BAND_LABELS[L.bandOf(p)] : p.level)}${U.statusBadge(p)}</div></div>
            <h2 style="margin-top:10px">${esc(p.name)}</h2>
            <dl class="rc-dl">
              <dt>Level</dt><dd>${esc(p.level)}${p.association && p.association !== "NCAA" ? ` (${esc(p.association)})` : ""}</dd>
              <dt>Conference</dt><dd>${esc(p.conference || "Not listed")}</dd>
              <dt>Location</dt><dd>${esc([p.city, p.state].filter(Boolean).join(", ") || "Not listed")}</dd>
              ${nextCamp.get(p.id) ? `<dt>Next camp</dt><dd>${esc(nextCamp.get(p.id).title || "Camp")}, ${esc(L.fmtDate(nextCamp.get(p.id).start_date, { weekday: "short", month: "short", day: "numeric" }))}. <a href="camps.html?q=${encodeURIComponent(p.name)}">See it in Camp Finder</a></dd>` : ""}
              <dt>Last checked</dt><dd>${p.last_checked ? esc(L.fmtDate(p.last_checked)) : "Official links not checked yet"}</dd>
            </dl>
          </section>
          <section class="rc-panel">
            <h3>Academics and cost</h3>
            ${hasAcad ? `<dl class="rc-dl">${acad.filter(a => a[1] != null).map(a => `<dt>${esc(a[0])}</dt><dd>${esc(a[1])}</dd>`).join("")}</dl>
              <p class="rc-small" style="margin:12px 0 0">Reporting year: ${esc(p.academic_year || "not recorded")}${U.safeUrl(p.academic_source_url) ? ` · <a class="rc-link" href="${esc(p.academic_source_url)}" target="_blank" rel="noopener">Source</a>` : ""}</p>`
              : `<p class="rc-muted" style="margin:0">Not loaded yet for this school. Check the U.S. Department of Education <a class="rc-link" href="https://collegescorecard.ed.gov/search/?search=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">College Scorecard</a>.</p>`}
          </section>
          <section class="rc-panel">
            <h3>Where this listing came from</h3>
            <p class="rc-small" style="margin:0">${esc(p.listing_source || "Added by Peach State Recruits")}${U.safeUrl(p.listing_source_url) ? ` · <a class="rc-link" href="${esc(p.listing_source_url)}" target="_blank" rel="noopener">${esc(U.host(p.listing_source_url))}</a>` : ""}. Coach names and emails are not listed here. Find them on the school's official staff page.</p>
          </section>
        </div>
        <aside>
          <section class="rc-panel">
            <h3>Your list</h3>
            ${s ? `<p class="rc-small" style="margin-top:0">Saved. Interest: ${esc(s.interest[0].toUpperCase() + s.interest.slice(1))} · Stage: ${esc((s.stage[0].toUpperCase() + s.stage.slice(1)).replace(/_/g, " "))}</p>` : `<p class="rc-small" style="margin-top:0">Save this school to track emails, notes and follow-ups.</p>`}
            <div class="rc-row">
              <button class="rc-btn ${s ? "dark" : "primary"}" data-save="${esc(p.id)}" aria-pressed="${s ? "true" : "false"}">${s ? "Saved" : "Save school"}</button>
              <a class="rc-btn" href="${emailHref(p)}">Email this coach</a>
            </div>
          </section>
          <section class="rc-panel">
            <h3>${links.length ? "Official links" : "Find their pages"}</h3>
            ${links.length ? `<div class="rc-links">${links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}<span>${esc(U.host(u))}</span></a>`).join("")}</div>` : ""}
            ${quick.length ? `<div class="rc-links rc-quick">${quick.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}<span>${esc(U.host(u))}</span></a>`).join("")}</div>` : ""}
            ${missing.length && home ? `<p class="rc-small" style="margin:8px 0 0">Their ${esc(missing.length > 1 ? missing.slice(0, -1).join(", ") + " and " + missing[missing.length - 1] : missing[0])} ${missing.length > 1 ? "are" : "is"} on the <a class="rc-link" href="${esc(home)}" target="_blank" rel="noopener">${siteOk ? "official athletics site" : "school website"}</a>, under Baseball.</p>` : ""}
          </section>
        </aside>
      </div>`;
  }

  function route() {
    const m = /school=([^&]+)/.exec(location.hash);
    const main = $("#finder"), det = $("#detail");
    if (m) {
      let slug; try { slug = decodeURIComponent(m[1]); } catch (_) { slug = ""; }
      const p = programs.find(x => x.slug === slug);
      if (!p) { det.innerHTML = `<div class="rc-empty">School not found. <a class="rc-link" href="#">Back to all schools</a></div>`; }
      else { det.innerHTML = detailHtml(p); document.title = `${p.name} Baseball | College Finder | Peach State Recruits`; }
      main.classList.add("rc-hide"); det.classList.remove("rc-hide");
      const b = $("#back"); if (b) b.onclick = e => { e.preventDefault(); location.hash = ""; };
      window.scrollTo(0, 0);
    } else {
      det.classList.add("rc-hide"); main.classList.remove("rc-hide");
      document.title = "College Finder: Baseball Programs | Peach State Recruits";
    }
  }

  // ------------------------------------------------------------ save
  async function toggleSave(id, btn) {
    if (!user) {
      const d = U.openDialog(`<div class="rc-dlg-body" id="gateBox"></div>`);
      U.renderGate($("#gateBox", d), api, { title: "Sign in to save schools", onSignedIn: async () => { d.close(); await refreshSaved(); renderList(); route(); toggleSave(id); } });
      return;
    }
    try {
      const s = saved.get(id);
      if (s) { await api.table("saved_schools").remove(s.id); saved.delete(id); U.toast("Removed from your list"); }
      else {
        const r = await api.table("saved_schools").insert({ program_id: id, interest: "medium", stage: "researching" });
        saved.set(id, r); U.toast("Saved to your list");
      }
      renderList(); route();
    } catch (e) { U.toast(e.message.includes("uuid") || e.message.includes("foreign key") ? "Saving needs the live directory. Ask the site owner to finish setup." : e.message); }
  }

  async function start() {
    U.navInit();
    readQuery();
    $("#demo").innerHTML = U.demoBanner(api);
    try { programs = await api.listPrograms(); } catch (e) { $("#results").innerHTML = `<div class="rc-empty">Couldn't load the directory. ${esc(e.message)}</div>`; return; }
    // Next camp per school, from Camp Finder. Loads after the list so it never slows the directory down.
    api.listCamps().then(cs => { nextCamp = L.nextCampByProgram(cs, new Date()); if (nextCamp.size) { renderList(); if (/^#school=/.test(location.hash)) route(); } }).catch(() => {});
    try { await refreshSaved(); } catch (e) { U.toast("Your saved schools could not be loaded: " + e.message); }
    $("#total").textContent = programs.length.toLocaleString();
    $("#coverage").innerHTML = `<p class="rc-coverage">Each school links to its official athletics site. Check the current coaching staff and roster there before you reach out or pay for a camp. <a class="rc-link" href="recruiting-roadmap.html#plan">Build your recruiting plan</a>.</p>`;
    renderAll(); route();
    if (state.fromFml) { const jumpToResults = () => { const r = document.getElementById("results"); if (!r || location.hash) return; const hdr = document.querySelector("header"); const y = r.getBoundingClientRect().top + window.scrollY - ((hdr && hdr.offsetHeight) || 0) - 12; window.scrollTo({ top: Math.max(0, y), behavior: "auto" }); }; requestAnimationFrame(jumpToResults); }
    window.addEventListener("hashchange", route);
    document.addEventListener("click", e => { const b = e.target.closest("[data-save]"); if (b) { e.preventDefault(); toggleSave(b.dataset.save, b); } });
    api.onAuth(async () => { await refreshSaved(); renderList(); route(); });
  }
  start();
})();
