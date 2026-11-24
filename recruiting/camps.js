/* Camp Finder (camps.html) */
(function () {
  "use strict";
  const L = window.PSRLogic, U = window.PSRUI, { esc, $, $$ } = U;
  const api = window.PSRData.init();
  U.updateStamp(api, document.getElementById("lastUpdate"), "camps");
  let camps = [], user = null, saved = new Map();
  const f = { q: "", states: [], bands: [], gradYear: "", maxPrice: "", from: "", to: "" };
  // Links from Find My Level: camps.html?levels=NCAA%20D1,NCAA%20D2&grad=2028&from=fml
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get("bands")) f.bands = qs.get("bands").split(",").filter(b => L.BANDS.includes(b));
    else if (qs.get("levels")) f.bands = L.bandsFromLevels(qs.get("levels").split(",").map(x => x.trim()));
    if (/^20\d\d$/.test(qs.get("grad") || "")) f.gradYear = qs.get("grad");
    if (qs.get("q")) f.q = qs.get("q").slice(0, 80);
  } catch (e) {}

  async function refreshSaved() {
    user = await api.getUser(); saved = new Map();
    if (user) (await api.table("saved_camps").list()).forEach(s => saved.set(s.camp_id, s));
  }
  function filters() {
    const cy = new Date().getFullYear();
    $("#side").innerHTML = `
      <form class="rc-panel rc-filters" id="filters">
        <label class="rc-field">Search<input class="rc-input" type="search" id="q" placeholder="School, camp or city" value="${esc(f.q)}"></label>
        <label class="rc-field" style="margin-top:12px">State<select class="rc-select" id="st">${U.stateOptions(f.states[0])}</select></label>
        <fieldset class="rc-fs" style="margin-top:12px"><legend>Host level</legend><div class="rc-checks">${L.BANDS.map(b => `<label class="rc-check"><input type="checkbox" name="lvl" value="${b}"${f.bands.includes(b) ? " checked" : ""}>${esc(L.BAND_LABELS[b])}</label>`).join("")}</div></fieldset>
        <label class="rc-field">Your grad year<select class="rc-select" id="gy"><option value="">Any</option>${Array.from({ length: 6 }, (_, i) => cy + i).map(y => `<option${String(y) === f.gradYear ? " selected" : ""}>${y}</option>`).join("")}</select><small>Hides camps that list other grad years</small></label>
        <label class="rc-field" style="margin-top:12px">Max price ($)<input class="rc-input" type="number" min="0" id="mp" value="${esc(f.maxPrice)}"></label>
        <div class="rc-grid2" style="margin-top:12px"><label class="rc-field">From<input class="rc-input" type="date" id="from" value="${esc(f.from)}"></label><label class="rc-field">To<input class="rc-input" type="date" id="to" value="${esc(f.to)}"></label></div>
      </form>
      <div class="rc-panel"><h3>About these listings</h3><p class="rc-small" style="margin:0">This is a curated starter list, not a complete nationwide camp calendar. Budget filters exclude unknown prices. Each camp comes from the school's own camp page or its official registration page, with the date we last checked it. Past camps are hidden automatically. Prices, dates and coaches can change, so always confirm on the official page before you register or travel.</p></div>`;
    const upd = () => { render(); };
    $("#q").oninput = e => { f.q = e.target.value; upd(); };
    $("#st").onchange = e => { f.states = e.target.value ? [e.target.value] : []; upd(); };
    $$("input[name=lvl]").forEach(c => c.onchange = () => { f.bands = $$("input[name=lvl]:checked").map(x => x.value); upd(); });
    $("#gy").onchange = e => { f.gradYear = e.target.value; upd(); };
    $("#mp").oninput = e => { f.maxPrice = e.target.value; upd(); };
    $("#from").onchange = e => { f.from = e.target.value; upd(); };
    $("#to").onchange = e => { f.to = e.target.value; upd(); };
    $("#filters").onsubmit = e => e.preventDefault();
    if (window.matchMedia("(max-width:900px)").matches) $("#filters").classList.add("collapsed");
  }
  function card(c) {
    const s = saved.get(c.id);
    const stale = L.isStale(c, new Date(), 45);
    return `<article class="rc-panel" style="margin:0">
      <div class="rc-camp">
        <div class="rc-date" aria-hidden="true"><b>${esc(String(L.parseISO(c.start_date).getDate()))}</b><span>${esc(L.fmtDate(c.start_date, { month: "short" }))}</span></div>
        <div>
          <h3 style="margin:0;font-family:var(--body);font-weight:800;font-size:18px;text-transform:none;letter-spacing:0;line-height:1.3">${esc(c.title)}</h3>
          <div class="rc-meta">${c.level ? U.levelBadge(c.level === "NCAA D1" && c.band ? L.BAND_LABELS[c.band] : c.level) : ""}<span>${esc(c.program_name || c.host_name || "")}</span><span>${esc([c.city, c.state].filter(Boolean).join(", "))}</span></div>
        </div>
        <div class="rc-actions"><button class="rc-btn sm${s ? " dark" : ""}" data-save="${esc(c.id)}" aria-pressed="${s ? "true" : "false"}">${s ? "Saved" : "Save"}</button></div>
      </div>
      <dl class="rc-dl" style="margin-top:12px;font-size:14px">
        <dt>Dates</dt><dd>${esc(L.fmtDate(c.start_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }))}${c.end_date && c.end_date !== c.start_date ? ` to ${esc(L.fmtDate(c.end_date, { weekday: "short", month: "short", day: "numeric" }))}` : ""}${c.time_note ? ` · ${esc(c.time_note)}` : ""}</dd>
        <dt>Price</dt><dd>${c.price_cents != null ? esc(L.money(c.price_cents / 100)) : "Not listed"}${c.price_note ? `<br><span class="rc-small">${esc(c.price_note)}</span>` : ""}</dd>
        <dt>Who</dt><dd>${c.grad_years && c.grad_years.length ? `Grad years ${esc(c.grad_years.join(", "))}` : ""}${c.eligibility_note ? esc(c.eligibility_note) : (c.grad_years && c.grad_years.length ? "" : "Not listed")}</dd>
        ${c.positions ? `<dt>Positions</dt><dd>${esc(c.positions)}</dd>` : ""}
        <dt>Coaches</dt><dd>${c.confirmed_coaches ? esc(c.confirmed_coaches) : "Not named on the official page"}</dd>
        <dt>Checked</dt><dd>${esc(L.fmtDate(c.last_checked))} · <a class="rc-link" href="${esc(U.safeUrl(c.source_url))}" target="_blank" rel="noopener">${esc(U.host(c.source_url))}</a>${stale ? ' <span class="rc-badge warn">May be out of date</span>' : ""}</dd>
      </dl>
      <div class="rc-row" style="margin-top:12px">
        ${U.safeUrl(c.registration_url) ? `<a class="rc-btn sm primary" href="${esc(c.registration_url)}" target="_blank" rel="noopener">Register on official page</a>` : ""}
        <button class="rc-btn sm" data-ics="${esc(c.id)}">Add to calendar</button>
        <button class="rc-btn sm" data-est="${esc(c.id)}">Estimate travel cost</button>
        ${c.program_slug ? `<a class="rc-btn sm" href="colleges.html#school=${encodeURIComponent(c.program_slug)}">School details</a>` : ""}
      </div>
    </article>`;
  }
  function render() {
    const res = L.filterCamps(camps, { q: f.q, states: f.states, bands: f.bands, gradYear: f.gradYear, maxPrice: f.maxPrice ? Number(f.maxPrice) : null, from: f.from, to: f.to }, new Date());
    $("#results").innerHTML = `<div class="rc-results-head"><p style="margin:0"><b>${res.length}</b> upcoming camp${res.length === 1 ? "" : "s"}</p>
      <div class="rc-row"><button class="rc-btn sm rc-filters-toggle" id="tf" type="button">Filters</button>${res.length ? `<button class="rc-btn sm" id="icsAll">Add these to calendar</button>` : ""}${user ? `<a class="rc-btn sm" href="my-recruiting.html#camps">My camps (${saved.size})</a>` : ""}</div></div>
      ${f.bands.length ? `<p class="rc-note">Showing camps hosted by ${esc(f.bands.map(x => L.BAND_LABELS[x]).join(" and "))} programs. Most camps are open to any player, so it's worth checking other levels too. <button class="rc-btn sm" id="allLv" type="button">Show every level</button></p>` : ""}
      <div class="rc-list">${res.map(card).join("") || `<div class="rc-empty">No upcoming camps match. Many schools post winter and summer camps on their own athletics site. Check the camps page of the schools on your list.</div>`}</div>`;
    $("#tf").onclick = () => $("#filters").classList.toggle("collapsed");
    if ($("#allLv")) $("#allLv").onclick = () => { f.bands = []; $$("input[name=lvl]").forEach(c => c.checked = false); render(); };
    if ($("#icsAll")) $("#icsAll").onclick = () => U.download("camps.ics", L.buildICS(res), "text/calendar");
  }
  function estimate(c) {
    const s = saved.get(c.id);
    const t = Object.assign({}, L.TRAVEL_DEFAULTS, (s && s.travel) || {});
    const fld = (k, l, step) => `<label class="rc-field">${l}<input class="rc-input" type="number" min="0" step="${step || 1}" data-t="${k}" value="${esc(t[k])}"></label>`;
    U.openDialog(`<div class="rc-dlg-body"><h2>Travel estimate</h2><p class="rc-muted" style="margin-top:0">${esc(c.title)} · ${esc([c.city, c.state].filter(Boolean).join(", "))}. Enter your own numbers. Nothing is looked up.</p>
      <div class="rc-est">${fld("miles_one_way", "Miles one way")}${fld("mpg", "Car MPG")}${fld("gas_price", "Gas $/gal", 0.01)}${fld("nights", "Hotel nights")}${fld("hotel_rate", "Hotel $/night")}${fld("rooms", "Rooms")}${fld("days", "Days")}${fld("people", "People eating")}${fld("meal_cost", "$ per meal")}${fld("meals_per_day", "Meals per day")}${fld("other", "Other $")}</div>
      <div id="br" style="margin-top:14px"></div>
      <div class="rc-dlg-actions">${s ? `<button class="rc-btn primary" id="keep">Save to my camp</button>` : `<span class="rc-small">Save the camp to keep this estimate.</span>`}<button class="rc-btn" id="cl">Close</button></div></div>`, d => {
      const read = () => { const o = {}; $$("[data-t]", d).forEach(i => o[i.dataset.t] = Number(i.value) || 0); o.include_registration = true; return o; };
      const show = () => { const e = L.travelEstimate(read(), c); $("#br", d).innerHTML = `<p class="rc-total" style="margin:0">${esc(L.money(e.total))}</p><p class="rc-small">${e.complete ? "Estimated total" : "Partial estimate: excludes unknown fees"}${e.errors.length ? " · " + esc(e.errors.join(" ")) : ""}</p><p class="rc-small" style="margin:4px 0 0">Gas ${esc(L.money(e.gas))} · Hotel ${esc(L.money(e.hotel))} · Food ${esc(L.money(e.meals))} · Camp ${c.price_cents != null ? esc(L.money(e.registration)) : "price not listed"} · Other ${esc(L.money(e.other))}</p>`; };
      $$("[data-t]", d).forEach(i => i.oninput = show); show();
      $("#cl", d).onclick = () => d.close();
      if ($("#keep", d)) $("#keep", d).onclick = async () => { try { Object.assign(s, await api.table("saved_camps").update(s.id, { travel: read() })); U.toast("Saved"); d.close(); } catch (e) { U.toast(e.message); } };
    });
  }
  async function toggleSave(id) {
    if (!user) {
      const d = U.openDialog(`<div class="rc-dlg-body" id="gb"></div>`);
      U.renderGate($("#gb", d), api, { title: "Sign in to save camps", onSignedIn: async () => { d.close(); await refreshSaved(); toggleSave(id); } });
      return;
    }
    try {
      const s = saved.get(id);
      if (s) { await api.table("saved_camps").remove(s.id); saved.delete(id); U.toast("Removed"); }
      else { const r = await api.table("saved_camps").insert({ camp_id: id, status: "interested" }); saved.set(id, r); U.toast("Saved to My Recruiting"); }
      render();
    } catch (e) { U.toast(/uuid|foreign key/.test(e.message) ? "Saving needs the live camp list. Ask the site owner to finish setup." : e.message); }
  }
  async function start() {
    U.navInit();
    $("#demo").innerHTML = U.demoBanner(api);
    try { camps = await api.listCamps(); await refreshSaved(); } catch (e) { $("#results").innerHTML = `<div class="rc-empty">Could not load camps: ${esc(e.message)}. Reload to try again.</div>`; return; }
    filters(); render();
    if (new URLSearchParams(location.search).get("from") === "fml") { const jumpToResults = () => { const r = document.getElementById("results"); if (!r || location.hash) return; const hdr = document.querySelector("header"); const y = r.getBoundingClientRect().top + window.scrollY - ((hdr && hdr.offsetHeight) || 0) - 12; window.scrollTo({ top: Math.max(0, y), behavior: "auto" }); }; requestAnimationFrame(jumpToResults); }
    document.addEventListener("click", e => {
      const s = e.target.closest("[data-save]"); if (s) return toggleSave(s.dataset.save);
      const i = e.target.closest("[data-ics]"); if (i) { const c = camps.find(x => x.id === i.dataset.ics); return U.download(L.slugify(c.title) + ".ics", L.buildICS([c]), "text/calendar"); }
      const t = e.target.closest("[data-est]"); if (t) return estimate(camps.find(x => x.id === t.dataset.est));
    });
    api.onAuth(async () => { await refreshSaved(); render(); });
  }
  start();
})();
