/*
  College Baseball Level Estimator: interface. Uses PSRLevel (logic) and PSRLevelConfig (config).
  Metrics stay in the browser, in the player's own account when signed in (recruiting/levelsync.js), or with us only if they tap Send (the opt-in free review). The site's cookie-free page counter (shared.js) records only that the page was visited.
  The only network calls are the two static benchmark files and, after Send, one insert into
  level_reviews. Completed results are saved in this browser's localStorage (progress), and the
  player can clear them.
*/
(function () {
  "use strict";
  const L = window.PSRLevel, CFG = window.PSRLevelConfig, S = L.S, V = window.PSRLevelV2, PG = window.PSRLevelProgress, Z = window.PSRLevelSize, PF = window.PSRPitcherFit, QF = window.PSRPositionFit;
  const store = (() => { try { const k = "__psr_t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  const app = document.getElementById("lvlApp");
  if (!app || !L) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Field definitions ----------
  const F = {
    maxFb:     { label: "Peak fastball", unit: "mph", kind: "number", hint: "Your highest valid fastball reading." },
    typFb:     { label: "Sitting fastball", unit: "mph", kind: "number", hint: "What you usually sit at in games. Coaches screen on this as much as your peak." },
    strikePct: { label: "Strike %", unit: "%", kind: "percent", hint: "Strikes ÷ all pitches, from your season stats." },
    ip:        { label: "Innings pitched", unit: "IP", kind: "number", hint: "Season total, like 45.1 (45 and one out)." },
    so:        { label: "Strikeouts", unit: "K", kind: "number", hint: "Season total. Turned into K/9 for you." },
    bb:        { label: "Walks", unit: "BB", kind: "number", hint: "Season total. Turned into BB/9 for you." },
    bbVelo:    { label: "Breaking ball velocity", unit: "mph", kind: "number", hint: "Your best breaking ball (slider or curve), typical speed." },
    chVelo:    { label: "Changeup velocity", unit: "mph", kind: "number", hint: "Typical changeup speed, if you throw one." },
    era:       { label: "ERA", unit: "runs / 9 inn", kind: "number", hint: "Season ERA." },
    whip:      { label: "WHIP", unit: "(H+BB) / inn", kind: "number", hint: "Season WHIP." },
    maxEv:     { label: "Max exit velocity", unit: "mph", kind: "number", hint: "Hardest ball you've hit on a measuring device." },
    avgEv:     { label: "Average exit velocity", unit: "mph", kind: "number", hint: "No published level benchmark; used only to check your max." },
    sixty:     { label: "60-yard dash", unit: "seconds", kind: "seconds", hint: "Best time, with a decimal (for example 6.95)." },
    thirty:    { label: "30-yard sprint", unit: "seconds", kind: "seconds", hint: "Only compared with 30-yard benchmarks. Never converted to a 60." },
    ifVelo:    { label: "Infield throwing velocity", unit: "mph", kind: "number", hint: "Position throw across the infield, not a pitch." },
    ofVelo:    { label: "Outfield throwing velocity", unit: "mph", kind: "number", hint: "Position throw from the outfield, not a pitch." },
    cVelo:     { label: "Catcher throwing velocity", unit: "mph", kind: "number", hint: "Throw from the catching position." },
    pop:       { label: "Best pop time to 2B", unit: "seconds", kind: "seconds", hint: "Glove to glove, accurate throw (for example 2.05)." },
    avg:       { label: "Batting average", unit: "", kind: "ratio", hint: "For example .345" },
    obp:       { label: "On-base percentage", unit: "", kind: "ratio", hint: "For example .420" },
    slg:       { label: "Slugging", unit: "", kind: "ratio", hint: "For example .510" },
    fbSpin:    { label: "Fastball spin", unit: "rpm", kind: "rpm", hint: "Average four-seam spin, for example 2150. Context only." },
    bbSpin:    { label: "Breaking-ball spin", unit: "rpm", kind: "rpm", hint: "Curveball or slider spin. Context only." },
    extension: { label: "Extension", unit: "ft", kind: "number", hint: "Release extension, for example 6.1. Recorded only." },
    ivb:       { label: "Induced vertical break", unit: "in", kind: "signed", hint: "Four-seam IVB, for example 16.5. Context only." },
    batSpeed:  { label: "Bat speed", unit: "mph", kind: "number", hint: "From Blast or a similar sensor. Context only." },
    fpsPct:    { label: "First-pitch strike %", unit: "%", kind: "percent", hint: "Shown with your command. No published level benchmark yet, so it isn't scored." },
    zonePct:   { label: "Zone %", unit: "%", kind: "percent", hint: "Pitches in the strike zone, from TrackMan or charting. Shown, not scored." },
    bbWhiff:   { label: "Breaking ball whiff %", unit: "%", kind: "percent", hint: "Swings and misses ÷ swings. Shown, not scored." },
    chWhiff:   { label: "Changeup whiff %", unit: "%", kind: "percent", hint: "Swings and misses ÷ swings. Shown, not scored." },
    pa:        { label: "Plate appearances", unit: "PA", kind: "number", hint: "Season total. Bigger samples raise your confidence score." },
    hk:        { label: "Strikeouts", unit: "K", kind: "number", hint: "Season total as a hitter. Turned into K% for you." },
    hbb:       { label: "Walks", unit: "BB", kind: "number", hint: "Season total as a hitter. Turned into BB% for you." }
  };
  const PITCHES = ["Four-seam fastball", "Two-seam / sinker", "Curveball", "Slider", "Sweeper", "Changeup", "Cutter", "Splitter", "Knuckle-curve", "Other"];
  const ENV = [["", "I don't know"], ["game", "Game"], ["showcase", "Showcase"], ["bullpen", "Bullpen"], ["facility", "Facility / training"], ["tee", "Tee"], ["front_toss", "Front toss"], ["live_bp", "Live BP"]];
  const METHOD = [["", "I don't know"], ["radar", "Radar gun"], ["trackman", "TrackMan"], ["rapsodo", "Rapsodo"], ["sensor", "Bat or ball sensor"], ["electronic", "Laser / electronic timing"], ["hand", "Hand-held stopwatch"]];
  const SOURCE = [["self", "Self-reported"], ["event", "Event or showcase result"], ["device", "Device report"], ["", "I don't know"]];
  const IF = ["1B", "2B", "SS", "3B"], OF = ["LF", "CF", "RF"];
  const SIXTY_M = [["", "I don't know"], ["laser", "Laser / electronic"], ["hand", "Hand-timed"]];
  const EV_M = [["", "I don't know"], ["tee", "Tee"], ["bp", "Live BP"], ["game", "Game"]];
  const EV_DEV = [["", "I don't know"], ["trackman", "TrackMan"], ["rapsodo", "Rapsodo"], ["hittrax", "HitTrax"], ["blast", "Blast"], ["pocket", "Pocket Radar"], ["other", "Other"]];
  const VELO_DEV = [["", "I don't know"], ["gun", "Radar gun"], ["pocket", "Pocket Radar"], ["trackman", "TrackMan"], ["rapsodo", "Rapsodo"], ["stadium", "Stadium gun"], ["other", "Other"]];
  const PITCH_DEV = [["", "I don't know"], ["trackman", "TrackMan"], ["rapsodo", "Rapsodo"], ["other", "Other"]];
  const GRADES = [["", "Work it out from the date"], ["8", "8th grade or earlier"], ["9", "9th (freshman)"], ["10", "10th (sophomore)"], ["11", "11th (junior)"], ["12", "12th (senior)"], ["grad", "After graduating"]];
  const BB_TYPES = [["", "Not sure"], ["Slider", "Slider"], ["Curveball", "Curveball"], ["Sweeper", "Sweeper"], ["Cutter", "Cutter"], ["Knuckle-curve", "Knuckle-curve"]];
  const COMPETITION = [["", "Not sure"], ["varsity", "High school varsity"], ["jv", "High school JV"], ["travel", "Travel / summer ball"], ["showcase", "Showcase or top travel circuit"], ["college", "College / JUCO"]];
  const TOOL_LABEL = { hitting: "Hitting", running: "Running", throwing: "Throwing", pitching: "Fastball" };

  // ---------- State (memory only) ----------
  const state = {
    step: 1, data: null, result: null, confirmed: new Set(), gapCat: {},
    raw: {}, unknown: new Set(),
    input: { gradYear: null, primary: "", secondary: "", throws: "", bats: "", heightIn: null, weightLb: null, metrics: { repertoire: [] }, methods: { sixty: "", ev: "", evDevice: "", veloDevice: "", pitchDevice: "" }, meta: { date: "", environment: "", method: "", source: "", link: "", grade: "" } }
  };

  const positions = () => [state.input.primary, state.input.secondary].filter(Boolean);
  const hasP = () => positions().includes("P");
  const hasField = () => positions().some(p => p !== "P");

  // ---------- Rendering helpers ----------
  function errorsFor(field, v) {
    const e = v.errors.filter(x => x.field === field).map(x => `<p class="lvl-err" id="err-${field}">${esc(x.msg)}</p>`);
    const w = v.warnings.filter(x => x.field === field).map(x => `<div class="lvl-warn" id="err-${field}"><p>${esc(x.msg)}</p><label class="lvl-check"><input type="checkbox" data-confirm="${field}"> This metric is correct</label></div>`);
    return e.join("") + w.join("");
  }
  const NOV = { errors: [], warnings: [] };

  function numField(key, v, opts) {
    const d = F[key]; opts = opts || {};
    const id = "f_" + key, unk = state.unknown.has(key);
    const raw = state.raw[key] != null ? state.raw[key] : "";
    const invalid = v.errors.some(x => x.field === key) || v.warnings.some(x => x.field === key);
    const im = d.kind === "number" && /mph/.test(d.unit) ? "decimal" : "decimal";
    return `<div class="lvl-field${invalid ? " is-invalid" : ""}" data-wrap="${key}">
      <label for="${id}">${esc(d.label)}${opts.optional ? ' <span class="lvl-opt">optional</span>' : ""}</label>
      <div class="lvl-input-unit"><input class="input" id="${id}" data-num="${key}" data-kind="${d.kind}" inputmode="${im}" autocomplete="off" value="${esc(raw)}" ${unk ? "disabled" : ""} aria-describedby="hint-${key}${invalid ? " err-" + key : ""}"${invalid ? ' aria-invalid="true"' : ""}>${d.unit ? `<span class="lvl-unit" aria-hidden="true">${esc(d.unit)}</span>` : ""}</div>
      <p class="lvl-hint" id="hint-${key}">${esc(d.hint)}${d.unit ? ` <span class="sr-only">Unit: ${esc(d.unit)}.</span>` : ""}</p>
      <label class="lvl-check"><input type="checkbox" data-unknown="${key}" ${unk ? "checked" : ""}> I don't know</label>
      ${errorsFor(key, v)}
    </div>`;
  }
  function seg(name, label, options, value, v, required) {
    const invalid = v.errors.some(x => x.field === name);
    return `<fieldset class="lvl-field lvl-seg-wrap${invalid ? " is-invalid" : ""}" data-wrap="${name}"><legend>${esc(label)}${required ? "" : ' <span class="lvl-opt">optional</span>'}</legend>
      <div class="lvl-seg">${options.map(([val, l]) => `<label><input type="radio" name="${name}" value="${esc(val)}" ${value === val ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>${errorsFor(name, v)}</fieldset>`;
  }
  function select(name, label, options, value, v, opts) {
    opts = opts || {};
    const invalid = v.errors.some(x => x.field === name);
    return `<div class="lvl-field${invalid ? " is-invalid" : ""}" data-wrap="${name}"><label for="f_${name}">${esc(label)}${opts.optional ? ' <span class="lvl-opt">optional</span>' : ""}</label>
      <select class="select" id="f_${name}" data-sel="${name}"${invalid ? ` aria-invalid="true" aria-describedby="err-${name}"` : ""}>${options.map(([val, l]) => `<option value="${esc(val)}" ${String(value) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
      ${opts.hint ? `<p class="lvl-hint">${esc(opts.hint)}</p>` : ""}${errorsFor(name, v)}</div>`;
  }
  function summary(v, fields) {
    const list = v.errors.concat(v.warnings).filter(x => fields.includes(x.field));
    if (!list.length) return "";
    return `<div class="lvl-summary" role="alert" tabindex="-1" id="lvlSummary"><b>Please check ${list.length === 1 ? "this entry" : "these entries"}:</b><ul>${list.map(x => `<li><a href="#f_${x.field}" data-focus="${x.field}">${esc(x.msg)}</a></li>`).join("")}</ul></div>`;
  }

  // ---------- Steps ----------
  const STEP1 = ["gradYear", "primary", "secondary", "throws", "bats", "heightIn", "weightLb"];
  function step1(v) {
    const i = state.input, y = new Date().getFullYear();
    const years = [["", "Choose year"]].concat(Array.from({ length: 11 }, (_, k) => [String(y - 2 + k), String(y - 2 + k)]));
    const pos = [["", "Choose position"]].concat(CFG.POSITIONS.map(p => [p.code, p.label]));
    const pos2 = [["", "None"]].concat(CFG.POSITIONS.map(p => [p.code, p.label]));
    const ft = [["", "ft"]].concat([4, 5, 6, 7].map(n => [String(n), n + " ft"])), inch = [["", "in"]].concat(Array.from({ length: 12 }, (_, k) => [String(k), k + " in"]));
    const hFt = i.heightIn != null ? String(Math.floor(i.heightIn / 12)) : (state.raw.hFt || ""), hIn = i.heightIn != null ? String(i.heightIn % 12) : (state.raw.hIn || "");
    return `<form class="lvl-card lvl-form" data-step="1" novalidate>
      <h2>About the player</h2>
      <p class="lvl-sub">Position decides which metrics we ask for next. A second position gets its own separate read.</p>
      ${summary(v, STEP1)}
      <div class="lvl-grid">
        ${select("gradYear", "Graduation year", years, i.gradYear != null ? i.gradYear : "", v)}
        ${select("primary", "Primary position", pos, i.primary, v)}
        ${select("secondary", "Second position", pos2, i.secondary, v, { optional: true, hint: "Two-way? Pick Pitcher here (or as primary) for a separate pitching read." })}
      </div>
      <div class="lvl-grid">
        ${seg("throws", "Throws", [["R", "Right"], ["L", "Left"]], i.throws, v, true)}
        ${seg("bats", "Bats", [["R", "Right"], ["L", "Left"], ["S", "Switch"]], i.bats, v, true)}
      </div>
      <div class="lvl-hw">
        <div class="lvl-grid">
          <div class="lvl-field${v.errors.some(x => x.field === "heightIn") || v.warnings.some(x => x.field === "heightIn") ? " is-invalid" : ""}" data-wrap="heightIn"><span class="lvl-label" id="hLbl">Height</span><div class="lvl-pair">
            <select class="select" id="f_heightIn" data-h="ft" aria-labelledby="hLbl" aria-required="true"${v.errors.some(x => x.field === "heightIn") ? ` aria-invalid="true" aria-describedby="err-heightIn"` : ""}>${ft.map(([a, b]) => `<option value="${a}" ${hFt === a ? "selected" : ""}>${b}</option>`).join("")}</select>
            <select class="select" data-h="in" aria-label="Height, inches">${inch.map(([a, b]) => `<option value="${a}" ${hIn === a ? "selected" : ""}>${b}</option>`).join("")}</select></div>${errorsFor("heightIn", v)}</div>
          <div class="lvl-field${v.errors.some(x => x.field === "weightLb") || v.warnings.some(x => x.field === "weightLb") ? " is-invalid" : ""}" data-wrap="weightLb"><label for="f_weightLb">Weight</label><div class="lvl-input-unit"><input class="input" id="f_weightLb" data-plain="weightLb" inputmode="numeric" autocomplete="off" aria-required="true"${v.errors.some(x => x.field === "weightLb") ? ` aria-invalid="true" aria-describedby="err-weightLb"` : ""} value="${esc(state.raw.weightLb != null ? state.raw.weightLb : (i.weightLb != null ? i.weightLb : ""))}"><span class="lvl-unit" aria-hidden="true">lb</span></div>${errorsFor("weightLb", v)}</div>
        </div>
        <p class="lvl-hint">Used for the "Your frame" comparison only. Height and weight never change your level.</p>
      </div>
      <div class="lvl-actions"><span class="lvl-privacy">Your metrics stay on this device, and in your private account if you're signed in. <a href="privacy.html">Privacy</a></span><button class="btn btn-peach btn-lg" type="submit">Next: your metrics</button></div>
    </form>`;
  }

  function step2Fields() {
    const f = [];
    if (hasP()) f.push("maxFb", "typFb", "ip", "so", "bb", "era", "whip", "strikePct", "bbVelo", "chVelo", "fbSpin", "bbSpin", "extension", "ivb", "fpsPct", "zonePct", "bbWhiff", "chWhiff");
    if (hasField()) {
      f.push("maxEv", "sixty", "avgEv", "batSpeed", "thirty", "avg", "obp", "slg", "pa", "hk", "hbb");
      if (positions().some(p => IF.includes(p))) f.push("ifVelo");
      if (positions().some(p => OF.includes(p))) f.push("ofVelo");
      if (positions().includes("C")) f.push("cVelo", "pop");
    }
    return f;
  }
  function step2(v) {
    const fs = step2Fields(), parts = [];
    if (hasP()) {
      const rep = state.input.metrics.repertoire || [];
      parts.push(`<fieldset class="lvl-group"><legend>Pitching</legend>
        <h3 class="lvl-subh">Velocity</h3>
        <div class="lvl-grid">${numField("maxFb", v)}${numField("typFb", v, { optional: true })}</div>
        <h3 class="lvl-subh">Season stats <span class="lvl-opt">optional, but they score your command and game performance</span></h3>
        <div class="lvl-grid">${numField("ip", v, { optional: true })}${numField("so", v, { optional: true })}${numField("bb", v, { optional: true })}${numField("era", v, { optional: true })}${numField("whip", v, { optional: true })}${numField("strikePct", v, { optional: true })}${select("pCompetition", "Level of competition", COMPETITION, state.input.metrics.pCompetition || "", v, { optional: true })}</div>
        <h3 class="lvl-subh">Secondary pitches <span class="lvl-opt">optional</span></h3>
        <fieldset class="lvl-field"><legend>Pitches you throw in games</legend><div class="lvl-chips">${PITCHES.map(p => `<label><input type="checkbox" data-rep="${esc(p)}" ${rep.includes(p) ? "checked" : ""}><span>${esc(p)}</span></label>`).join("")}</div></fieldset>
        <div class="lvl-grid">${select("bbType", "Main breaking ball", BB_TYPES, state.input.metrics.bbType || "", v, { optional: true })}${numField("bbVelo", v, { optional: true })}${numField("chVelo", v, { optional: true })}</div>
        <details class="lvl-more"><summary>Add TrackMan or Rapsodo data <span class="lvl-opt">optional</span></summary><div class="lvl-grid">${numField("fbSpin", v, { optional: true })}${numField("ivb", v, { optional: true })}${numField("extension", v, { optional: true })}${numField("bbSpin", v, { optional: true })}${numField("fpsPct", v, { optional: true })}${numField("zonePct", v, { optional: true })}${numField("bbWhiff", v, { optional: true })}${numField("chWhiff", v, { optional: true })}</div>
          <div class="lvl-grid">${select("pitchDevice", "Spin and movement measured with", PITCH_DEV, state.input.methods.pitchDevice, v, { optional: true })}</div></details>
      </fieldset>`);
    }
    if (hasField()) {
      const throws = [];
      if (positions().some(p => IF.includes(p))) throws.push(numField("ifVelo", v));
      if (positions().some(p => OF.includes(p))) throws.push(numField("ofVelo", v));
      if (positions().includes("C")) throws.push(numField("cVelo", v), numField("pop", v));
      const fieldPos = positions().filter(p => p !== "P").join(" and ");
      parts.push(`<fieldset class="lvl-group"><legend>Hitting, running and throwing <small>(${esc(fieldPos)})</small></legend>
        <div class="lvl-grid">${numField("maxEv", v)}${numField("sixty", v, { optional: positions().includes("C") })}${throws.join("")}</div>
        <h3 class="lvl-subh">Season stats <span class="lvl-opt">optional, shown next to your tools</span></h3>
        <div class="lvl-grid">${numField("avg", v, { optional: true })}${numField("obp", v, { optional: true })}${numField("slg", v, { optional: true })}${numField("pa", v, { optional: true })}${numField("hk", v, { optional: true })}${numField("hbb", v, { optional: true })}${select("competition", "Level of competition", COMPETITION, state.input.metrics.competition || "", v, { optional: true })}</div>
        <details class="lvl-more"><summary>Add sensor data <span class="lvl-opt">optional</span></summary><div class="lvl-grid">${numField("avgEv", v, { optional: true })}${numField("batSpeed", v, { optional: true })}${numField("thirty", v, { optional: true })}</div></details>
      </fieldset>`);
    }
    return `<form class="lvl-card lvl-form" data-step="2" novalidate>
      <h2>Your current metrics</h2>
      <p class="lvl-sub">Enter what you know. Leave a box blank or tick "I don't know" if you don't have it. Blank is treated as unknown, never as zero.</p>
      ${summary(v, fs)}
      ${parts.join("")}
      <details class="lvl-more lvl-methods"${Object.values(state.input.methods).some(Boolean) ? " open" : ""}><summary>How were these measured? <span class="lvl-opt">optional</span></summary>
        <p class="lvl-hint">Shown as a chip next to each metric. We never convert one method into another.</p>
        <div class="lvl-grid">
          ${hasField() ? select("m_sixty", "60-yard timed by", SIXTY_M, state.input.methods.sixty, v, { optional: true }) : ""}
          ${hasField() ? select("m_ev", "Exit velocity hit off", EV_M, state.input.methods.ev, v, { optional: true }) : ""}
          ${hasField() ? select("m_evDevice", "Exit velocity device", EV_DEV, state.input.methods.evDevice, v, { optional: true }) : ""}
          ${select("m_veloDevice", hasP() && hasField() ? "Velocity device (fastball and throws)" : hasP() ? "Fastball velocity device" : "Throwing velocity device", VELO_DEV, state.input.methods.veloDevice, v, { optional: true })}
        </div></details>
      <div class="lvl-actions"><button class="btn btn-line btn-lg" type="button" data-go="1">Back</button><button class="btn btn-peach btn-lg" type="submit">Next: about the metrics</button></div>
    </form>`;
  }

  const STEP3 = ["date", "environment", "method", "source", "link"];
  function step3(v) {
    const m = state.input.meta, unkDate = state.unknown.has("date");
    return `<form class="lvl-card lvl-form" data-step="3" novalidate>
      <h2>About these metrics</h2>
      <p class="lvl-sub">This tells us how comparable your metrics are. "I don't know" is fine; we'll explain what it means for the result.</p>
      ${summary(v, STEP3)}
      <div class="lvl-grid">
        <div class="lvl-field${v.errors.some(x => x.field === "date") ? " is-invalid" : ""}" data-wrap="date"><label for="f_date">When were they measured?</label>
          <input class="input" type="date" id="f_date" data-meta="date" value="${esc(m.date)}" max="${new Date().toISOString().slice(0, 10)}" ${unkDate ? "disabled" : ""}>
          <label class="lvl-check"><input type="checkbox" data-unknown="date" ${unkDate ? "checked" : ""}> I don't know</label>${errorsFor("date", v)}</div>
        ${select("environment", "Testing environment", ENV, m.environment, v)}
        ${select("method", "Measured with", METHOD, m.method, v)}
        ${select("grade", "What grade were you in when you got these metrics?", GRADES, m.grade, v, { optional: true, hint: "Used only for the same-age comparison. It never changes your level." })}
      </div>
      ${seg("source", "Where do the metrics come from?", SOURCE, m.source, v, true)}
      <div class="lvl-field${v.errors.some(x => x.field === "link") ? " is-invalid" : ""}" data-wrap="link"><label for="f_link">Result link <span class="lvl-opt">optional</span></label>
        <input class="input" type="url" id="f_link" data-meta="link" inputmode="url" placeholder="https://" value="${esc(m.link)}" autocomplete="off">
        <p class="lvl-hint">Saved as a reference on your result only. A link alone doesn't verify the metrics, and we don't open or analyze it.</p>${errorsFor("link", v)}</div>
      <div class="lvl-actions"><button class="btn btn-line btn-lg" type="button" data-go="2">Back</button><button class="btn btn-peach btn-lg" type="submit">See my results</button></div>
    </form>`;
  }

  // ---------- Results ----------
  const pillClass = (st) => st === S.MEETS ? "ok" : st === S.BELOW ? "below" : st === S.NO_INPUT ? "none" : "na";
  const fmtV = (v, unit) => L.fmt(v, unit === "seconds" ? "seconds" : unit === "mph" ? "mph" : unit);

  const R = window.PSRLevelReport, Research = window.PSRResearch;
  const U = window.PSRLevelSummary, ds = (s) => esc(U.deSource(s));
  const statusText = (st) => st === S.NO_BENCH ? "No published target" : st;
  const ST_CLASS = { "Meets targets": "ok", "Close": "close", "Below targets": "below", "Needs more metrics": "none", "No published target": "na" };

  function toolRow(k, t) {
    const val = t.value != null ? `<span class="lvl-you">You: ${esc(fmtV(t.value, t.unit))}</span>` : "";
    const tgt = t.band && t.status !== S.NO_BENCH ? `<span class="lvl-tgt">${t.estimated ? "Estimated target" : "Target"}: ${esc(t.band)}${t.qualifier && /open|least|single|says/i.test(t.qualifier) ? ` <small>(${esc(t.qualifier)})</small>` : ""}</span>` : "";
    const extra = t.status === S.BELOW ? `<span class="lvl-gap">${t.unit === "seconds" ? esc(t.gap.toFixed(2)) + " s slower than" : esc(t.gap) + " mph short of"} the listed ${t.unit === "seconds" ? esc(t.threshold.toFixed(2)) + " s" : esc(t.threshold) + " mph"} mark</span>` : "";
    return `<li class="lvl-tool">
      <div class="lvl-tool-top"><b>${esc(TOOL_LABEL[k])}</b><span class="lvl-pill ${pillClass(t.status)}">${esc(statusText(t.status))}</span></div>
      <div class="lvl-tool-meta">${val}${tgt}${extra}</div>
      ${t.note ? `<p class="lvl-note-sm">${ds(t.note)}</p>` : ""}
      ${(t.status === S.NO_BENCH || t.status === S.REF_ONLY || t.status === S.NOT_COMP) && t.reason ? `<p class="lvl-note-sm">${ds(t.reason)}${t.status === S.REF_ONLY && t.band ? ` Source value: ${esc(t.band)}.` : ""}</p>` : ""}
      ${t.estimated && t.estimateMethod ? `<p class="lvl-note-sm"><b>Estimated target.</b> ${esc(t.estimateMethod)}</p>` : ""}
      ${t.pooledNote ? `<p class="lvl-note-sm">${esc(t.pooledNote)}</p>` : t.pooledGroup ? `<p class="lvl-note-sm">The source combines NAIA and JUCO for this target.</p>` : ""}
    </li>`;
  }

  function catCard(read, c) {
    const comp = c.compared.map(k => TOOL_LABEL[k]);
    const notIn = c.missing.filter(x => x.status === S.NO_INPUT).map(x => TOOL_LABEL[x.tool]);
    const noTgt = c.missing.filter(x => x.status !== S.NO_INPUT).map(x => TOOL_LABEL[x.tool]);
    const st = U.levelStatus(read, c);
    const noData = read.kind === "position" && c.key === "low";
    const ns = c.nsRef && c.nsRef.cmp.status !== S.NO_BENCH ? `<div class="lvl-ns"><span class="lvl-kind ref">Second source</span> <b>${esc(c.nsRef.label)}</b> <small>(its group: ${esc(c.nsRef.sourceLevel)})</small>
      <div class="lvl-tool-meta"><span class="lvl-pill ${pillClass(c.nsRef.cmp.status)}">${esc(statusText(c.nsRef.cmp.status))}</span>${c.nsRef.cmp.band && c.nsRef.cmp.status !== S.NO_BENCH ? `<span class="lvl-tgt">Target: ${esc(c.nsRef.cmp.band)}</span>` : ""}</div>
      ${c.nsRef.cmp.status === S.NO_BENCH ? `<p class="lvl-note-sm">${ds(c.nsRef.cmp.reason)}</p>` : ""}${c.nsRef.pooledNote ? `<p class="lvl-note-sm">${ds(c.nsRef.pooledNote)}</p>` : ""}
      <p class="lvl-note-sm">A separate published target. Shown for reference; not used for the level status.</p></div>` : "";
    return `<details class="lvl-cat${c.highlighted ? " is-hl" : ""}" data-cat="${c.key}">
      <summary><span class="lvl-cat-h"><h4>${esc(c.label)}</h4><span class="lvl-st ${ST_CLASS[st]}">${esc(st)}</span></span>
        <span class="lvl-mini">${read.toolKeys.map(k => `<span><b>${esc(TOOL_LABEL[k])}</b> <i class="lvl-pill ${pillClass(c.tools[k].status)}">${esc(statusText(c.tools[k].status))}</i></span>`).join("")}</span>
        <span class="lvl-more-k" aria-hidden="true">Details</span></summary>
      <p class="lvl-src"><span class="lvl-kind guide">Published target</span> Category: ${esc(c.ncLabel)}</p>
      ${noData ? (Object.values(c.tools).some(t => t.fill) ? `<p class="lvl-note-sm"><b>The main target source has no separate Lower D1 targets for position players.</b> These come from other published sources; any target with no published value anywhere is marked as an estimate and says how it was set.</p>` : `<p class="lvl-note-sm"><b>This source has no separate lower D1 targets for position players.</b> This is a data gap, not a negative result. Nothing is borrowed from mid-major or other D1 metrics.</p>`) : ""}
      <ul class="lvl-tools">${read.toolKeys.map(k => toolRow(k, c.tools[k])).join("")}</ul>
      <p class="lvl-cov"><b>Compared:</b> ${comp.length ? esc(comp.join(", ")) : "none"}${noTgt.length ? ` · <b>No published target:</b> ${esc(noTgt.join(", "))}` : ""}${notIn.length ? ` · <b>Not entered:</b> ${esc(notIn.join(", "))}` : ""}</p>
      ${ns}
    </details>`;
  }

  const PANEL_TITLE = { BP: "Committed players' best showcase results", FG: "Outfielders during or after their junior season", SL: "Rising-senior summer group" };
  function panelHtml(p) {
    const rows = p.rows.map(r => {
      const cells = r.notComparable ? `<p class="lvl-pill na">${esc(S.NOT_COMP)}</p><p class="lvl-note-sm">${ds(r.notComparable)}</p>${r.cells.length ? `<ul class="lvl-means">${r.cells.map(c => `<li><span>${esc(c.col)}</span><b>${c.mean == null ? "Not published" : esc(fmtV(c.mean, r.unit))}</b></li>`).join("")}</ul>` : ""}`
        : `<ul class="lvl-means">${r.cells.map(c => {
          if (c.status === S.NO_BENCH) return `<li><span>${esc(c.col)}</span><b>—</b><em class="na">No published average</em></li>`;
          if (c.status === S.NO_INPUT) return `<li><span>${esc(c.col)}</span><b>${esc(fmtV(c.mean, r.unit))}</b><em class="none">Not entered</em></li>`;
          const d = r.unit === "seconds" ? c.absDiff.toFixed(2) + " s" : r.unit === "ratio" ? c.absDiff.toFixed(3).replace(/^0/, "") : r.unit === "percent" ? Math.round(c.absDiff * 1000) / 10 + " pts" : (Math.round(c.absDiff * 10) / 10) + (r.unit === "mph" ? " mph" : "");
          return `<li><span>${esc(c.col)}</span><b>${esc(fmtV(c.mean, r.unit))}</b><em class="${c.favorable === true ? "ok" : c.favorable === false ? "below" : "na"}">${esc(c.status)}${c.absDiff ? ` by ${esc(d)}` : ""}</em></li>`;
        }).join("")}</ul>`;
      return `<div class="lvl-prow"><div class="lvl-prow-h"><b>${esc(r.label)}</b>${r.value != null ? `<span class="lvl-you">You: ${esc(fmtV(r.value, r.unit))}</span>` : ""}<small>${r.direction === "lower_is_better" ? "Lower is better" : "Higher is better"}</small></div>${cells}${(r.caveats || []).map(c => `<p class="lvl-note-sm">${ds(c)}</p>`).join("")}</div>`;
    }).join("");
    return `<div class="lvl-panel lvl-panel-flat" data-panel="${esc(p.id)}"><h4><span class="lvl-kind mean">Average</span> ${esc(PANEL_TITLE[p.id] || U.deSource(p.title))}</h4>
      <p class="lvl-note-sm">${ds(p.population)}</p>
      ${p.note ? `<p class="lvl-note-sm"><b>${ds(p.note)}</b></p>` : ""}
      ${rows}</div>`;
  }

  function collegeHtml(c) {
    if (!c) return "";
    return `<div class="lvl-panel lvl-panel-flat" data-panel="college"><h4><span class="lvl-kind ctx">College players</span> College pitchers' fastballs (context only)</h4>
      <p class="lvl-note-sm"><b>${ds(c.warning)}</b></p>
      <p class="lvl-note-sm">${ds(c.valueNote)}</p>
      <ul class="lvl-means">${c.rows.map(r => `<li><span>${esc(r.level)} ${esc(r.hand)}</span><b>${esc(r.mean)} mph</b><em class="na">${r.diff == null ? `n: ${esc(r.sample)}` : `You ${r.diff >= 0 ? "+" : ""}${esc(r.diff)} mph · n: ${esc(r.sample)}`}</em></li>`).join("")}</ul>
      <p class="lvl-note-sm">${ds(c.sec.text)}</p></div>`;
  }

  function yoursFor(read) {
    const m = state.input.metrics;
    return read.kind === "pitching" ? [["Max fastball", m.maxFb, "mph"], ["Typical game fastball", m.typFb, "mph"]]
      : [["Max exit velocity", m.maxEv, "mph"], ["60-yard dash", m.sixty, "seconds"]].concat(read.family === "C" ? [["Catcher throw", m.cVelo, "mph"], ["Best pop time", m.pop, "seconds"]] : read.family === "OF" ? [["Outfield throw", m.ofVelo, "mph"]] : [["Infield throw", m.ifVelo, "mph"]]);
  }

  function nextFor(read) {
    const n = U.nextStep(read);
    if (n) return n.text;
    const notIn = [...new Set(read.categories.flatMap(c => c.missing.filter(x => x.status === S.NO_INPUT).map(x => x.tool)))];
    if (notIn.length) return `Next step: add your ${notIn.map(k => ({ hitting: "max exit velocity", running: "60-yard dash", throwing: "throwing metrics", pitching: "fastball velocity" })[k]).join(" and ")} to compare more levels.`;
    return "Next step: get your full set of metrics and film in front of coaches. A published-target comparison can only go so far for this position.";
  }

  function sec(id, title, body) {
    return `<details class="lvl-sec" data-sec="${id}"><summary><span>${esc(title)}</span><i aria-hidden="true"></i></summary><div class="lvl-sec-b">${body}</div></details>`;
  }

  // Link the comparison to the College Finder by level only (no program-specific fit scores).
  function exploreHtml(read) {
    const at = U.schoolsAtLevel(read);
    const href = "colleges.html?" + (at.bands && at.bands.length ? "bands=" + encodeURIComponent(at.bands.join(",")) + "&" : "") + "from=fml";
    return `<div class="lvl-explore no-print"><p class="lvl-cta2-t">Explore college programs${at.atLevel ? ` at ${esc(at.labels.join(", "))}` : ""}</p>
      <p class="lvl-note-sm">Opens the College Finder filtered by level. It doesn't rate how you fit any specific school.</p>
      <a class="btn btn-line" href="${href}">Open College Finder</a></div>`;
  }

  // ---- v26: what moves you up, one-tap next steps, Peach State players like you ----
  function movesHtml(read) {
    const mv = U.movesUp(read);
    const steps = mv.next ? mv.next.steps : [];
    const add = mv.add.map(k => ({ hitting: "max exit velocity", running: "60-yard dash", throwing: read.family === "C" ? "pop time" : "throw", pitching: "fastball" })[k]);
    return `<section class="lvl-next lvl-moves" aria-label="What moves you up">
      <p class="lvl-next-k">What moves you up</p>
      <p class="lvl-next-t">${esc(mv.text)}</p>
      ${steps.length ? `<ul class="lvl-move-list">${steps.map(x => `<li>${steps.length > 1 ? `<b>${esc(x.action)}</b>` : ""}<span>You: ${esc(x.you)}</span><span>${x.estimated ? "Estimated target" : "Target"}: ${esc(x.unit === "seconds" ? x.threshold.toFixed(2) + " s" : x.threshold + " mph")}</span><span class="lvl-move-gap">${esc(x.change)}</span></li>`).join("")}</ul>` : ""}
      ${mv.jump ? `<p class="lvl-note-sm"><b>One change goes further:</b> ${esc(mv.jump.steps[0].action.charAt(0).toLowerCase() + mv.jump.steps[0].action.slice(1))} (${esc(mv.jump.steps[0].change)}) reaches the listed ${esc(mv.jump.label)} targets.</p>` : ""}
      ${add.length && (mv.next || mv.top) ? `<p class="lvl-note-sm">Not entered: ${esc(add.join(" and "))}. Add ${add.length > 1 ? "them" : "it"} for a fuller answer.</p>` : ""}
      <p class="lvl-note-sm">Based on the listed targets, not a prediction. Retest the same way you measured before.</p>
    </section>`;
  }
  function levelsFor(read) {
    return U.schoolsAtLevel(read).filters;
  }
  // ---- Schools to start with: a few programs at the player's level near home, each one tap from Email Coach ----
  let PROGRAMS = null, programsLoad = null, NEXT_CAMP = new Map(), campsLoad = null;
  // Next upcoming camp per school, read from the public Camp Finder table. Optional: picks draw without it.
  function loadCamps() {
    const C = window.PSR_CONFIG || {}, key = C.supabasePublishableKey || C.supabaseAnonKey;
    if (campsLoad || !C.supabaseUrl || !key || !window.PSRLogic.nextCampByProgram) return campsLoad || Promise.resolve();
    campsLoad = fetch(`${C.supabaseUrl}/rest/v1/camps?select=title,start_date,end_date,record_status,programs(slug)&order=start_date.asc&limit=1000`, { headers: { apikey: key, Authorization: "Bearer " + key } })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(rows => { NEXT_CAMP = window.PSRLogic.nextCampByProgram(rows, new Date(), c => c.programs && c.programs.slug); })
      .catch(() => {});
    return campsLoad;
  }
  function loadPrograms() {
    if (!programsLoad) programsLoad = fetch("data/programs.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { PROGRAMS = d.programs.map(p => Object.assign({ band: window.PSRLogic.bandOf(p) }, p)); })
      .catch(err => { programsLoad = null; throw err; });
    return programsLoad;
  }
  function homeState() { try { return localStorage.getItem(window.PSRPicks.STATE_KEY) || ""; } catch (_) { return ""; } }
  // Offer shown right after the college list: the moment a family is about to email coaches.
  function offerHtml(bands) {
    const C = window.PSR_CONFIG || {}, pk = (C.packages || []).find(p => p.id === "pro") || (C.packages || [])[0];
    if (!pk) return "";
    const band = (bands && bands[0]) || "";
    const who = band && window.PSRLogic && window.PSRLogic.BAND_LABELS[band] ? `${window.PSRLogic.BAND_LABELS[band]} coaches` : "College coaches";
    return `<section class="lvl-offer no-print" aria-label="Get in front of coaches">
      <h3>Give coaches something to click</h3>
      <p>${esc(who)} get a lot of emails. A link to your highlight video and profile page lets them see you play in one tap.</p>
      <p class="lvl-offer-pk"><b>${esc(pk.name)}, $${esc(pk.price)}</b>: ${esc(pk.tagline)}</p>
      <div class="lvl-offer-btns"><a class="btn btn-peach" href="index.html#packages" data-track="fml_offer_click" data-track-detail="${esc(band)}">See packages</a><a class="btn btn-line" href="players.html">See player examples</a></div>
    </section>`;
  }
  function picksHtml(bands, idx) {
    if (!window.PSRPicks || !window.PSRLogic || !bands || !bands.length) return offerHtml(bands);
    return offerHtml(bands) + `<section class="lvl-picks no-print" data-picks="${idx}" data-bands="${esc(bands.join(","))}" aria-label="Colleges at your level">
      <p class="lvl-cta2-t">Colleges at your level</p><div class="lvl-picks-b" aria-live="polite"><p class="lvl-note-sm">Loading schools…</p></div></section>`;
  }
  function drawPicks(sec) {
    const LG = window.PSRLogic, bands = sec.dataset.bands.split(","), idx = sec.dataset.picks, st = homeState();
    const r = window.PSRPicks.pick(PROGRAMS, bands, st);
    const label = bands.map(b => LG.BAND_LABELS[b]).join(" and ");
    const opts = LG.STATE_NAMES.map(n => `<option${n === st ? " selected" : ""}>${esc(n)}</option>`).join("");
    const list = !st ? `<p class="lvl-note-sm">Choose your state to see ${esc(label)} programs near you.</p>`
      : r.list.length ? `<ul class="lvl-pick-list">${r.list.map(p => `<li><div class="lvl-pick-n"><a href="colleges.html#school=${encodeURIComponent(p.slug)}">${esc(p.name)}</a><span>${esc(LG.BAND_LABELS[p.band] || p.level)}, ${esc(p.state)}</span>${NEXT_CAMP.get(p.slug) ? `<a class="lvl-pick-camp" href="camps.html?q=${encodeURIComponent(p.name)}">Next camp ${esc(LG.fmtDate(NEXT_CAMP.get(p.slug).start_date, { month: "short", day: "numeric" }))}</a>` : ""}</div><button class="lvl-pick-email" type="button" data-email-handoff="${idx}" data-school="${esc(p.slug)}">Email coach</button></li>`).join("")}</ul>`
      : `<p class="lvl-note-sm">No ${esc(label)} programs in or next to ${esc(st)}.</p>`;
    sec.querySelector(".lvl-picks-b").innerHTML = `<label class="lvl-picks-state"><span>Your home state</span><select data-picks-state><option value="">Choose a state</option>${opts}</select></label>
      ${list}
      <p class="lvl-note-sm">${st && r.list.length ? "Picked by level and distance from home, not by how you'd fit a program. " : ""}<a href="colleges.html?bands=${encodeURIComponent(bands.join(","))}&from=fml">See every ${esc(label)} program</a></p>`;
  }
  function fillPicks() {
    const secs = app.querySelectorAll("[data-picks]");
    if (!secs.length) return;
    loadCamps().then(() => { if (PROGRAMS && NEXT_CAMP.size) app.querySelectorAll("[data-picks]").forEach(drawPicks); });
    loadPrograms().then(() => secs.forEach(drawPicks)).catch(() => secs.forEach(s => {
      s.querySelector(".lvl-picks-b").innerHTML = `<p class="lvl-note-sm">The school list couldn't load. <a href="colleges.html?bands=${encodeURIComponent(s.dataset.bands)}&from=fml">Open College Finder</a> instead.</p>`;
    }));
  }

  // ---- Results layout: the answer first, the detail after ----
  // Top: level, how you line up, priorities, colleges at your level, next steps.
  // Everything else for that read goes into one closed "Full breakdown" section.
  function arrangeRead(readEl) {
    const board = readEl.querySelector(":scope > .lvl-board");
    if (!board || readEl.querySelector(":scope > .lvl-more")) return;
    const kids = [...board.children];
    const match = kids.find(c => c.classList.contains("lvl-match"));
    const where = kids.find(c => c.querySelector(".lvl-ptable-wrap"));
    const prio = kids.find(c => c.querySelector(".lvl-prio"));
    let at = match || null;
    [where, prio].forEach(el => { if (el && at) { at.after(el); at = el; } });
    const extra = document.createElement("div");
    extra.className = "lvl-board lvl-board-more";
    kids.filter(c => c.matches(".lvl-msum, .pro-source-note") && c !== where && c !== prio).forEach(c => extra.appendChild(c));
    const TOP = ".lvl-board, .lvl-picks, .lvl-offer, .lvl-onetap, .lvl-likeyou, .lvl-share";
    const rest = [...readEl.children].filter(c => !c.matches(TOP));
    const more = document.createElement("details");
    more.className = "lvl-more";
    more.dataset.more = readEl.dataset.read;
    more.innerHTML = `<summary><b>Full breakdown</b><span>Category scores, confidence, standout tools, what-ifs, how each score works and more</span></summary><div class="lvl-more-b"></div>`;
    const body = more.querySelector(".lvl-more-b");
    if (extra.children.length) body.appendChild(extra);
    rest.forEach(c => body.appendChild(c));
    ["lvl-picks", "lvl-offer", "lvl-onetap", "lvl-likeyou", "lvl-share"].forEach(cls => { const el = readEl.querySelector(":scope > ." + cls); if (el) readEl.appendChild(el); });
    readEl.appendChild(more);
  }
  window.addEventListener("beforeprint", () => document.querySelectorAll(".lvl-more:not([open])").forEach(d => { d.open = true; d.dataset.printOpened = "1"; }));
  window.addEventListener("afterprint", () => document.querySelectorAll(".lvl-more[data-print-opened]").forEach(d => { d.open = false; delete d.dataset.printOpened; }));

  function oneTapHtml(read, idx) {
    const at = U.schoolsAtLevel(read);
    const q = at.bands && at.bands.length ? "bands=" + encodeURIComponent(at.bands.join(",")) + "&" : "";
    const grad = state.input.gradYear ? "grad=" + encodeURIComponent(state.input.gradYear) + "&" : "";
    const where = at.atLevel ? at.labels.join(" · ") : "Every level's";
    const schoolTitle = at.atLevel ? "Schools at your level" : "Explore schools";
    const campTitle = at.atLevel ? "Camps for your level" : "Explore camps";
    return `<section class="lvl-onetap no-print" aria-label="Your next steps">
      <p class="lvl-cta2-t">Your next steps</p>
      <div class="lvl-onetap-grid">
        <button class="lvl-tap lvl-tap-main" type="button" data-email-handoff="${idx}"><b>Email a coach</b><span>A personal email with your real metrics</span></button>
        <a class="lvl-tap" href="colleges.html?${q}from=fml"><b>${schoolTitle}</b><span>${esc(where)} programs</span></a>
        <a class="lvl-tap" href="camps.html?${q}${grad}from=fml"><b>${campTitle}</b><span>Upcoming college camps</span></a>
        <a class="lvl-tap" href="my-recruiting.html?from=fml#profile"><b>Save to My Recruiting</b><span>Your metrics, schools and follow-ups</span></a>
      </div>
      <p class="lvl-note-sm">School and camp lists are filtered by level only. They don't rate how you fit any specific school.</p>
    </section>`;
  }
  const FAMILY_TOKENS = { P: ["P", "RHP", "LHP"], C: ["C"], IF: ["1B", "2B", "SS", "3B", "MIF", "IF", "INF", "UTL"], OF: ["OF", "LF", "CF", "RF"] };
  const famOf = (pos) => { const t = String(pos || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean); return Object.keys(FAMILY_TOKENS).filter(f => t.some(x => FAMILY_TOKENS[f].includes(x))); };
  const inchesOf = (h) => { const m = String(h || "").match(/(\d)\s*'\s*(\d{1,2})?/); return m ? +m[1] * 12 + (+m[2] || 0) : null; };
  function likeYou(players, read) {
    const fam = read.kind === "pitching" ? "P" : read.family, gy = +state.input.gradYear, hi = +state.input.heightIn;
    return players.filter(p => p.slug && famOf(p.position).includes(fam) && p.gradYear && Math.abs(+p.gradYear - gy) <= 1)
      .map(p => { const h = inchesOf((p.measurables || []).find(m => /height/i.test(m.label)) ? (p.measurables.find(m => /height/i.test(m.label)) || {}).value : ""); return { p, score: Math.abs(+p.gradYear - gy) * 10 + (h && hi ? Math.abs(h - hi) : 5) }; })
      .sort((a, b) => a.score - b.score).slice(0, 3).map(x => x.p);
  }
  let playersPromise = null;
  function fillLikeYou() {
    const boxes = [...app.querySelectorAll("[data-likeyou]")];
    if (!boxes.length) return;
    // Same-site copy of the public player list, so this page never contacts another server.
    playersPromise = playersPromise || fetch("players.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : []).then(list => (list || []).filter(p => p && p.active !== false && /baseball/i.test(p.sport || "baseball"))).catch(() => []);
    playersPromise.then(players => boxes.forEach(box => {
      const read = state.result && state.result.reads[+box.dataset.likeyou]; if (!read || !box.isConnected) return;
      const list = likeYou(players || [], read); if (!list.length) return;
      box.innerHTML = `<p class="lvl-cta2-t">Peach State players like you</p>
        <p class="lvl-note-sm">Featured players in your position group and a similar class. See how they show their film and metrics to coaches.</p>
        <div class="lvl-like-grid">${list.map(p => `<a class="lvl-like" href="player/${encodeURIComponent(p.slug)}/">${p.coverImage ? `<img src="${esc(String(p.coverImage).replace(/(images\/players\/[\w-]+)\.jpg$/, "$1-640.jpg"))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}<span><b>${esc(p.name)}</b><small>${esc([p.position, p.gradYear ? "Class of " + p.gradYear : "", p.school || p.team].filter(Boolean).join(" · "))}</small></span></a>`).join("")}</div>
        <p class="lvl-note-sm"><a href="index.html#packages">Get a profile like this</a></p>`;
      box.hidden = false;
    }));
  }

  function reportOverview(read,idx){
    const evidence=R.evidence(state.input,read), met=read.categories.filter(c=>c.highlighted), max=Math.max(0,...read.categories.map(c=>c.compared.length));
    return `<div class="pro-overview"><div><span>TOOLS COMPARED</span><strong>${max}<small> / ${read.toolKeys.length}</small></strong><p>${read.kind==='pitching'?'Fastball only; not a complete pitching evaluation.':'Distinct tools with targets in one category. Missing tools stay unknown.'}</p></div><div><span>CATEGORIES TO EXPLORE</span><strong>${met.length}</strong><p>${met.length?'Publisher targets met; several levels can overlap.':'More data or development may help. There is no ceiling assigned.'}</p></div><div><span>MEASUREMENT CONTEXT</span><strong class="pro-small-value">${esc(evidence.label)}</strong><p>${esc(evidence.sourceLabel)}.</p><button class="pro-text-button" type="button" data-edit-evidence>Review test details</button></div></div>
    ${evidence.issues.length?`<details class="pro-context"><summary>Make this comparison more useful <span>${evidence.issues.length} context notes</span></summary><ul>${evidence.issues.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>These notes affect how you interpret the result. They never add or subtract athletic points.</p></details>`:''}`;
  }
  function missingText(t){const m=(state.input&&state.input.metrics)||{};if(/fastball/i.test(t.label)&&m.maxFb!=null)return 'Not entered. This uses your typical game fastball, not your peak, so add that number to compare.';return 'Not entered. Add it to compare.';}
  function crossCheckHtml(read){const rows=R.crossCheck(state.data,state.input,read);return `<section class="pro-crosscheck"><div class="pro-section-head"><div><p class="pro-eyebrow">A SEPARATE REFERENCE</p><h3>NCSA guideline cross-check</h3></div><a href="https://www.ncsasports.org/baseball/recruiting-guidelines" target="_blank" rel="noopener">Read the source</a></div><p class="lvl-note-sm">NCSA groups all D1 together and combines D3 with NAIA. It cannot separate Power, mid-major and lower D1. Guidelines describe tools; they do not assign a player to a school.</p><div class="pro-cross-grid">${rows.map(r=>`<article><h4>${esc(r.level)}</h4>${r.tools.length?r.tools.map(t=>`<div><b>${esc(t.label)}</b><span>${esc(t.target)}</span><strong class="${t.met===null?'neutral':t.met?'positive':'attention'}">${t.value==null?esc(missingText(t)):esc(t.value+(t.unit==='s'?' s':' mph'))+' · '+(t.met?'Numerically meets':'Below guideline')}</strong><small>${esc(t.note)}</small></div>`).join(''):'<p>No usable numeric guideline for this position in our checked records. Review the source with your coach.</p>'}</article>`).join('')}</div></section>`;}
  function workbenchRows(read,key){const r=R.rows(read,key);return r.tools.map(t=>`<article class="pro-tool"><div><span>${esc(t.label)}</span><strong>${t.value==null?'Not entered':esc(fmtV(t.value,t.unit))}</strong></div><div><span>Published target</span><b>${t.target?esc(t.target):'Not published for this tool/category'}</b><small>${esc(statusText(t.status))}</small></div><div><span>What this tells you</span><p>${t.gap!=null?esc((t.unit==='seconds'?t.gap.toFixed(2)+' s':t.gap+' mph')+' from the listed edge.'):t.status===S.MEETS?'This metric reaches the listed edge. Keep game performance and consistency in the evaluation.':esc(t.note||'Add the relevant measurement or discuss the missing benchmark with your coach.')}${t.narrow?' <b>Small numerical gap: retest under the same protocol before treating this as a meaningful difference.</b>':''}</p></div></article>`).join('');}
  function workbenchHtml(read,idx){const chosen=state.gapCat[idx]||(read.categories.find(c=>c.highlighted)||read.categories[0]).key;return `<section class="pro-workbench" id="target-workbench${idx}"><div class="pro-section-head"><div><p class="pro-eyebrow">KNOW WHAT TO WORK ON</p><h3>Your target comparison</h3></div><label>Compare against<select class="select" data-target="${idx}" aria-label="Target category for ${esc(read.position)}">${read.categories.map(c=>`<option value="${c.key}" ${c.key===chosen?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label></div><div id="workbenchRows${idx}">${workbenchRows(read,chosen)}</div><p class="lvl-note-sm">Targets from NextCommit. Exact differences are arithmetic, not evidence of a meaningful performance gap or a training prescription.</p></section>`;}
  function scenarioHtml(read,idx){return `<details class="pro-scenario no-print"><summary>What if my metrics change?</summary><p>Try hypothetical measurements. Your actual result and saved history stay unchanged. This does not forecast development.</p><div class="pro-scenario-inputs">${R.fields(read).map(([k,l,u])=>`<label>${esc(l)} (${esc(u)})<input class="input" type="number" inputmode="decimal" step="0.01" data-scenario="${idx}:${k}" value="${state.input.metrics[k]??''}" min="${CFG.RANGES[k].hard[0]}" max="${CFG.RANGES[k].hard[1]}"></label>`).join('')}</div><button class="btn btn-line" type="button" data-run-scenario="${idx}">Compare hypothetical metrics</button><p id="scenarioResult${idx}" role="status"></p></details>`;}
  function runScenario(idx){const patch={};const output=document.getElementById('scenarioResult'+idx);app.querySelectorAll(`[data-scenario^="${idx}:"]`).forEach(el=>{if(el.value!=='')patch[el.dataset.scenario.split(':')[1]]=Number(el.value);});try{const r=R.scenario(state.data,state.input,state.result.reads[idx],patch);const met=r.read.categories.filter(c=>c.highlighted);output.textContent='Hypothetical only: '+(met.length?'reaches the listed targets for '+met.map(c=>c.label).join(', '):'does not fully reach a listed category with these inputs')+'. Actual result unchanged.';}catch(error){output.textContent=error.message;}}
  function nextMovesHtml(read){return `<section class="pro-actions"><p class="pro-eyebrow">TURN A RESULT INTO ACTION</p><h3>Your next three moves</h3><ol>${R.actionPlan(state.input,read).map((a,k)=>`<li><span>${k+1}</span><div><h4>${esc(a.title)}</h4><p>${esc(a.detail)}</p>${a.href==='#edit-evidence'?'<button class="pro-text-button" type="button" data-edit-evidence>Edit measurement context</button>':a.href==='#target-workbench'?'<p class="lvl-note-sm">Use the target comparison above.</p>':`<a href="${esc(a.href)}">${a.href.includes('email')?'Open Email Coach':'Find colleges'}</a>`}</div></li>`).join('')}</ol><div class="pro-snapshot"><button type="button" class="btn btn-line" data-copy-snapshot="${state.result.reads.indexOf(read)}">Copy coach snapshot</button><textarea class="input" id="snapshotText${state.result.reads.indexOf(read)}" hidden readonly aria-label="Coach snapshot text"></textarea><p>No assigned-level claim is added to your email. Coaches see your actual measurements.</p></div></section>`;}

  function titleHtml(read) {
    const raw = U.title(read), pos = U.POS[read.position] || read.position;
    const i = raw.toLowerCase().lastIndexOf(String(pos).toLowerCase());
    if (i < 0) return esc(raw);
    return esc(raw.slice(0, i)) + `<span class="lvl-accent">${esc(raw.slice(i, i + pos.length))}</span>` + esc(raw.slice(i + pos.length));
  }
  function metricIcon(key) {
    const p = {
      hitting: '<path d="M4.2 16.2l3 3 13-13-3-3-13 13zm14.3-11.6l1.9 1.9 1.6-1.6a1.3 1.3 0 10-1.9-1.9l-1.6 1.6z"/>',
      running: '<circle cx="8" cy="12" r="6.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8.2V12l2.6 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.2 7.5l2.2 2.2 3.2-1"/>',
      throwing: '<circle cx="8.2" cy="12" r="4.1"/><path d="M13.2 9.2c2.4 1.4 4.4 1.4 7.2.2-2.2 2.6-4.6 3.6-7.4 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      pitching: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2.4M12 18v2.4M3.6 12h2.4M18 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M6.2 17.8l1.7-1.7M16.1 7.9l1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    };
    return `<svg class="lvl-mbar-svg" viewBox="0 0 24 24" aria-hidden="true">${p[key] || p.hitting}</svg>`;
  }
  function ringHtml(read, m) {
    const h = U.headline(read);
    if (!m.enough || !h.level) return "";
    const l = m.levels.find(x => x.key === h.level);
    if (!l || !l.show) return "";
    const r = 58, c = 2 * Math.PI * r, dash = (l.pct / 100) * c;
    return `<div class="lvl-ring" data-level="${l.key}">
      <svg viewBox="0 0 144 144" role="img" aria-label="${esc(l.label)}: ${l.pct}% match, ${l.met} of ${l.of} metrics">
        <circle class="lvl-ring-track" cx="72" cy="72" r="${r}" fill="none" stroke-width="10"/>
        <circle class="lvl-ring-val" cx="72" cy="72" r="${r}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 72 72)"/>
      </svg>
      <div class="lvl-ring-caption"><b>${l.pct}%</b><span>${esc(l.label)}</span><small>match</small></div>
    </div>`;
  }
  function matchHtml(read) {
    const m = U.matchShare(read);
    const h = U.headline(read);
    const rows = m.enough ? `<div class="lvl-fit-row">${ringHtml(read, m)}<ol class="lvl-match-list">${m.levels.map(l => {
      const hl = h.level && l.key === h.level;
      const detail = l.show ? `<span class="lvl-match-pct">${l.pct}% match</span><small>${l.met} of ${l.of} metrics</small>`
        : `<span class="lvl-match-na">${l.reason === "no-target" ? "No published target" : "Needs more metrics"}</span>`;
      return `<li data-level="${l.key}"${l.show ? ` data-pct="${l.pct}"` : ""}${hl ? ' class="is-hl"' : ""}><b>${esc(l.label)}</b>${detail}</li>`;
    }).join("")}</ol></div>
      <p class="lvl-match-disc">${esc(m.disclaimer)}</p>` : `<p class="lvl-match-need">${esc(m.message)}</p>`;
    return `<section class="lvl-match" aria-label="Your college fit"><p class="lvl-pill-h">Your college fit</p>${rows}</section>`;
  }
  function outlookHtml(read) {
    const h = U.headline(read), o = U.outlook(read);
    const gaps = o.gaps && o.gaps.length ? `<ul class="lvl-rec-gaps">${o.gaps.map(g => `<li>${esc(g.text)}</li>`).join("")}</ul>` : (o.follow ? `<p class="lvl-rec-follow">${esc(o.follow)}</p>` : "");
    return `<section class="lvl-outlook lvl-head-card" aria-label="Your level outlook">
      <p class="lvl-pill-h">Your level outlook</p>
      <p class="lvl-head">${esc(h.text)}</p>
      ${gaps}
      <p class="lvl-head-sup">${esc(h.support)}</p>
      <p class="lvl-head-cav">${esc(U.CAVEAT)}</p>
    </section>`;
  }
  function metricsHtml(read) {
    const s = U.metricSummary(read);
    if (!s.bars.length) return `<section class="lvl-msum" aria-label="Your metrics summary"><p class="lvl-pill-h">Your metrics summary</p><p class="lvl-msum-need">No entered metrics could be compared with a published target yet.</p></section>`;
    const rows = s.bars.map(b => {
      const w = Math.round(b.fill * 100);
      return `<article class="lvl-mbar" data-tool="${esc(b.key)}" data-status="${b.status}">
        <span class="lvl-mbar-ico">${metricIcon(b.key)}</span>
        <div class="lvl-mbar-body">
          <div class="lvl-mbar-top"><b>${esc(b.label)} ${esc(b.valueText)}</b><span>target ${esc(b.targetText)}</span><em>${b.status}</em></div>
          <div class="lvl-mbar-track" aria-hidden="true"><span class="lvl-mbar-fill" style="width:${w}%"></span></div>
        </div>
      </article>`;
    }).join("");
    return `<section class="lvl-msum" aria-label="Your metrics summary">
      <p class="lvl-pill-h">Your metrics summary</p>
      <p class="lvl-msum-k">Compared with listed ${esc(s.levelLabel)} targets.</p>
      ${rows}
    </section>`;
  }
  function how3Html() {
    return `<ol class="lvl-how3" aria-label="How it works">
      <li><span>1</span><div><b>Enter your metrics</b><small>Add the measurements you have for your position.</small></div></li>
      <li><span>2</span><div><b>See your match by level</b><small>Each percentage is the share of your entered metrics that meet that level's published target.</small></div></li>
      <li><span>3</span><div><b>Take your next steps</b><small>Email a coach, find schools or work on a listed gap.</small></div></li>
    </ol>`;
  }

  function readHtml(read, idx) {
    if (read.kind === "pitching" && PF) return pitcherReadHtml(read, idx);
    if (read.kind === "position" && QF) return positionReadHtml(read, idx);
    const h = U.headline(read), i = state.input;
    const gapCat = state.gapCat[idx] || (read.categories.find(c => !c.highlighted && c.compared.length) || read.categories[0]).key;
    const gaps = L.gapsTo(read, gapCat);
    const strengths = read.strengths.map(s => {
      const metLabels = s.met.map(k => CFG.CATEGORIES.find(c => c.key === k).label);
      if (!s.met.length) return `<li><b>${esc(TOOL_LABEL[s.tool])}:</b> below every listed target we could compare.</li>`;
      return `<li><b>${esc(TOOL_LABEL[s.tool])}:</b> meets the listed target for ${esc(metLabels.join(", "))}.</li>`;
    });
    const m = i.metrics, yours = yoursFor(read);
    const lv = U.levels(read);
    const detail = `<div class="lvl-yours"><h4>Your metrics</h4><ul>${yours.map(([l, v, u]) => `<li><span>${esc(l)}</span><b>${v != null ? esc(fmtV(v, u)) : '<em>Not entered</em>'}</b></li>`).join("")}</ul>
        ${read.kind === "pitching" && (m.repertoire || []).length ? `<p class="lvl-note-sm">Repertoire: ${esc(m.repertoire.join(", "))}. Needs evaluation on video; no numeric targets exist.</p>` : ""}</div>
      <p class="lvl-note-sm">"Meets listed target" uses the edge of each published band as a provisional threshold. That is our implementation choice, not a researched average or an official cutoff. Testing context for these targets is unspecified.</p>
      <div class="lvl-cats">${read.categories.map(c => catCard(read, c)).join("")}</div>
      <div class="lvl-two">
        <div class="lvl-box"><h4>Strongest supported tools</h4>${strengths.length ? `<ul class="lvl-list">${strengths.join("")}</ul>` : `<p class="lvl-note-sm">No tool could be compared with a listed target yet.</p>`}</div>
        <div class="lvl-box"><h4>Gaps to a listed target</h4>
          <label class="lvl-label" for="gap${idx}">Compare with</label>
          <select class="select" id="gap${idx}" data-gap="${idx}">${read.categories.map(c => `<option value="${c.key}" ${c.key === gapCat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
          <ul class="lvl-list">${gaps.map(g => `<li><b>${esc(TOOL_LABEL[g.tool])}:</b> ${ds(g.text)}</li>`).join("")}</ul>
          <p class="lvl-note-sm">Closing a gap doesn't guarantee interest or an offer.</p></div>
      </div>`;
    const compare = `<p class="lvl-note-sm">These are averages of researched groups, not pass/fail lines. Being below an average doesn't rule you out. Each group is kept separate.</p>
      ${read.panels.map(panelHtml).join("")}${collegeHtml(read.college)}${idx === 0 ? advancedHtml() : ""}`;
    return `<section class="lvl-read" aria-labelledby="read${idx}" data-read="${idx}">
      <div class="lvl-board">
        <h2 class="lvl-res-title" id="read${idx}" tabindex="-1">${titleHtml(read)}</h2>
        ${read.kind === "pitching" ? `<p class="lvl-flag">Velocity comparison only</p>` : ""}
        ${matchHtml(read)}
        ${outlookHtml(read)}
        ${metricsHtml(read)}
        ${how3Html()}
        <p class="pro-source-note">Seven-category targets: <a href="https://www.nextcommit.ai/downloads/college-baseball-recruiting-standards-by-division.pdf" target="_blank" rel="noopener">NextCommit</a>. These publisher targets are one reference; the NCSA cross-check below stays separate.</p>
      </div>
      ${reportOverview(read, idx)}
      ${movesHtml(read)}
      ${picksHtml(U.schoolsAtLevel(read).bands, idx)}
      ${oneTapHtml(read, idx)}
      <div class="lvl-likeyou no-print" data-likeyou="${idx}" hidden></div>
      ${crossCheckHtml(read)}
      ${workbenchHtml(read, idx)}
      ${scenarioHtml(read, idx)}
      ${nextMovesHtml(read)}
      <div class="lvl-share no-print"><button class="btn btn-line" type="button" data-share="${idx}">Share my result</button><div class="lvl-share-out" id="shareOut${idx}" hidden></div></div>
      <div class="lvl-levels"><h3>Every level</h3>
        <ol class="lvl-lrow">${lv.map(l => `<li class="${ST_CLASS[l.status]}" data-level="${l.key}"><b>${esc(l.label)}</b><span>${esc(l.status)}</span></li>`).join("")}</ol>
        <p class="lvl-note-sm">D2, D3, NAIA and JUCO overlap; they are not a strict ladder. "Close" means at least one of your metrics meets that level's published target and at least one is below it.</p></div>
      ${numbersStrip(read)}
      ${sec("age-frame", "Same-grade, height and weight context", youngHtml(read, idx) + frameHtml(read, idx))}
      ${sec("levels", "All levels in detail", detail)}
      ${sec("compare", "How you compare with committed players", compare)}
    </section>`;
  }


  // ---------- v42: scoring engine v3 boards (pitchers and position players share one layout) ----------
  const FC = window.PSRFitCore;
  const LADDER = ["p4", "mid", "low", "d2", "d3", "naia"];
  const CLS_CLASS = { "Strong benchmark fit": "ok", "Competitive benchmark fit": "ok", "Developing benchmark fit": "close", "Below typical benchmark fit": "below", "Significant benchmark gaps": "below", "Incomplete evaluation": "none" };
  function pitcherFit() {
    const m = state.input.metrics || {};
    return PF.evaluate(state.input, { bbVelo: m.bbVelo, chVelo: m.chVelo });
  }
  function pRing(score, label, band) {
    const r = 58, c = 2 * Math.PI * r, dash = ((score || 0) / 100) * c;
    return `<div class="lvl-ring">
      <svg viewBox="0 0 144 144" role="img" aria-label="${esc(label)}: ${score == null ? "not scored" : score + " out of 100"}, ${esc(band)}">
        <circle class="lvl-ring-track" cx="72" cy="72" r="${r}" fill="none" stroke-width="10"/>
        <circle class="lvl-ring-val" cx="72" cy="72" r="${r}" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 72 72)"/>
      </svg>
      <div class="lvl-ring-caption"><b>${score == null ? "—" : score}</b><span>${esc(label)}</span><small>out of 100</small></div>
    </div>`;
  }
  // Radar chart. A category that isn't scored is drawn as a dashed spoke labeled "Not scored" and is
  // left out of the shape. It is never plotted as zero.
  function radarSvg(cats) {
    const n = cats.length, cx = 150, cy = 128, R = 88;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100]; };
    const rings = [25, 50, 75, 100].map(v => `<polygon class="lvl-radar-ring" points="${cats.map((c, i) => pt(i, v).map(x => x.toFixed(1)).join(",")).join(" ")}"/>`).join("");
    const spokes = cats.map((c, i) => { const [x, y] = pt(i, 100); return `<line class="lvl-radar-spoke${c.score == null ? " is-na" : ""}" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
    const scored = cats.map((c, i) => c.score == null ? null : pt(i, c.score)).filter(Boolean);
    const shape = scored.length >= 3 ? `<polygon class="lvl-radar-shape" points="${scored.map(p => p.map(x => x.toFixed(1)).join(",")).join(" ")}"/>` : scored.length === 2 ? `<polyline class="lvl-radar-shape" points="${scored.map(p => p.map(x => x.toFixed(1)).join(",")).join(" ")}"/>` : "";
    const dots = scored.map(p => `<circle class="lvl-radar-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5"/>`).join("");
    const labels = cats.map((c, i) => { const [x, y] = pt(i, 122); const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
      return `<text class="lvl-radar-label${c.score == null ? " is-na" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}"><tspan>${esc(c.label)}</tspan><tspan x="${x.toFixed(1)}" dy="14">${c.score == null ? "Not scored" : c.score}</tspan></text>`; }).join("");
    const desc = cats.map(c => `${c.label} ${c.score == null ? "not scored" : c.score}`).join(", ");
    return `<svg class="lvl-radar" viewBox="-45 0 390 270" role="img" aria-label="Category scores: ${esc(desc)}">${rings}${spokes}${shape}${dots}${labels}</svg>`;
  }
  const VER_SHORT = (v) => v >= 100 ? "Verified" : v >= 85 ? "Event or device" : v >= 70 ? "Self-reported, electronic" : v >= 50 ? "Self-reported" : "Not given";

  function fitHead(read, idx, flag) {
    return `<p class="lvl-eval-k">Your college baseball recruiting evaluation</p>
      <h2 class="lvl-res-title" id="read${idx}" tabindex="-1">${titleHtml(read)}</h2><p class="lvl-flag">${esc(flag)}</p>`;
  }
  function matchSection(fit, M) {
    const lv = (k) => fit.levels.find(l => l.key === k);
    const anchor = lv(fit.primary || fit.closest), stretch = fit.stretch ? lv(fit.stretch) : null, juco = lv("juco");
    const tiles = LADDER.map(lv).map(l => l.score == null
      ? `<li data-level="${l.key}"><b>${esc(l.short)}</b><span class="lvl-match-na">Needs more data</span></li>`
      : `<li data-level="${l.key}" data-score="${l.display}"${l.key === anchor.key ? ' class="is-hl"' : ""}><b>${esc(l.short)}</b><span class="lvl-match-pct">${l.display}<small>/100</small></span><small class="lvl-cls-${CLS_CLASS[l.classification]}">${esc(l.classification)}</small><span class="lvl-tile-bar" aria-hidden="true"><i style="width:${l.display}%"></i></span></li>`).join("");
    const also = fit.also.map(k => lv(k).short);
    const tie = fit.ties.length ? `<p class="lvl-best-a lvl-tie">Your ${esc(anchor.short)} score ties with ${esc(fit.ties.map(k => lv(k).short).join(" and "))}. When scores tie, the higher category is listed as the target and the tie is shown here, so nothing is hidden.</p>` : "";
    return `<section class="lvl-match" aria-label="Your college fit">
        <p class="lvl-pill-h">Your best college match</p>
        <div class="lvl-fit-row">${pRing(anchor.display, anchor.short, anchor.classification)}
          <div class="lvl-best">
            ${fit.primary ? `<p class="lvl-best-k">Primary recruiting target${fit.provisional ? " (provisional)" : ""}</p><p class="lvl-best-l">${esc(anchor.label)}</p>`
              : `<p class="lvl-best-k">Primary recruiting target</p><p class="lvl-best-l">Further evaluation needed</p><p class="lvl-best-a">No level reaches 85 with its core benchmarks met. Closest category: <b>${esc(anchor.label)}</b>.</p>`}
            <p class="lvl-best-s">${anchor.display}/100 · ${esc(anchor.classification)}</p>
            <p class="lvl-best-a"><b>Stretch target:</b> ${stretch ? `${esc(stretch.label)} (${stretch.display}/100, ${esc(stretch.classification.toLowerCase())})` : esc(fit.stretchReason || "Not established with current data.")}</p>
            ${also.length ? `<p class="lvl-best-a"><b>Additional opportunities:</b> ${esc(also.join(", "))}</p>` : ""}
            ${tie}
            ${fit.provisional ? `<p class="lvl-best-a lvl-prov">Provisional: there isn't enough verified, recent data to stand behind this target yet. See Evaluation confidence below.</p>` : ""}
          </div></div>
        <ol class="lvl-match-list lvl-pfit">${tiles}</ol>
        <p class="lvl-match-disc">${esc(M.DISCLAIMER)} The order of the categories is for navigation only; it isn't a strict talent ladder.</p>
      </section>
      <section class="lvl-msum lvl-juco" aria-label="JUCO recruiting pathway" data-level="juco">
        <p class="lvl-pill-h">JUCO recruiting pathway</p>
        ${juco && juco.score != null ? `<div class="lvl-conf-row"><b>${juco.display}<small>/100</small></b><p>${esc(juco.classification)}. JUCO is its own pathway, not a level below NAIA or D3. Programs range from developmental to some of the most competitive baseball in the country, so these benchmarks and weights are provisional.</p></div>`
          : `<p class="lvl-msum-k">Not scored with the data entered. JUCO is its own pathway, not a level below NAIA or D3.</p>`}
      </section>`;
  }
  function categoriesSection(fit, anchor, intro) {
    const list = fit.categories.map(c => c.score != null
      ? `<article class="lvl-pcat" data-cat="${c.key}"><div><b>${esc(c.label)}</b><span>${c.score}</span></div><div class="lvl-mbar-track" aria-hidden="true"><span class="lvl-mbar-fill" style="width:${c.score}%"></span></div>
          ${c.limited ? `<p><em class="lvl-tag">Limited assessment</em> Scored from the one benchmarked metric we have. ${c.unscored && c.unscored.length ? "Not benchmarked yet: " + esc(c.unscored.join(", ").toLowerCase()) + "." : ""}</p>` : ""}${c.why ? `<p>${esc(c.why)}</p>` : ""}</article>`
      : `<article class="lvl-pcat is-na" data-cat="${c.key}"><div><b>${esc(c.label)}</b><span>Not scored</span></div><p>${esc(c.why)}</p></article>`).join("");
    return `<section class="lvl-msum" aria-label="Your category scores">
        <p class="lvl-pill-h">Your category scores</p>
        <p class="lvl-msum-k">${esc(intro)}</p>
        <div class="lvl-radar-wrap">${radarSvg(fit.categories)}</div>
        <div class="lvl-pcats">${list}</div>
      </section>`;
  }
  function standoutsSection(fit) {
    if (!fit.standouts || !fit.standouts.length) return "";
    return `<section class="lvl-msum lvl-standouts" aria-label="Standout tools"><p class="lvl-pill-h">Standout tools</p>
      <ul class="lvl-badges">${fit.standouts.map(s => `<li><b>${esc(s.tool)}</b><span>${esc(s.detail)}</span></li>`).join("")}</ul>
      <p class="lvl-msum-k">A standout tool is shown when a number meets the Power 4 benchmark. It never adds points to your score.</p></section>`;
  }
  function confidenceSection(conf) {
    const W = FC.CONFIG.confidence.weights, P = conf.parts, N = conf.notes;
    const rows = [["Completeness", "completeness"], ["Verification", "verification"], ["Recency", "recency"], ["Sample size", "sample"]]
      .map(([l, k]) => `<li><span>${esc(l)} <small>${Math.round(W[k] * 100)}%</small></span><b>${Math.round(P[k])}</b><em>${esc(N[k])}</em></li>`).join("");
    return `<section class="lvl-msum lvl-conf" aria-label="Evaluation confidence">
        <p class="lvl-pill-h">Evaluation confidence</p>
        <div class="lvl-conf-row"><b>${conf.score}<small>/100</small></b><p><strong>${esc(conf.label)}.</strong> How much of this evaluation is backed by complete, verified, recent numbers. It isn't a talent rating and never changes your fit scores.${conf.incomplete ? " Essential data is missing, so confidence is capped." : ""}</p></div>
        <ul class="lvl-conf-parts">${rows}</ul>
        ${conf.missing.length ? `<p class="lvl-msum-k">Raise your confidence:</p><ol class="lvl-conf-list">${conf.missing.slice(0, 4).map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : `<p class="lvl-msum-k">Your evaluation is well supported.</p>`}
      </section>`;
  }
  // rows: [{ label, you, target, stretchTarget, gap, status: ok|close|below|na, statusText }]
  function whereSection(rows, anchor, stretch, conf, notes) {
    const ver = VER_SHORT(conf.parts.verification);
    const body = rows.map(r => `<tr class="is-${r.status}"><th scope="row">${esc(r.label)}</th><td><b>${esc(r.you)}</b></td><td>${esc(r.target)}</td><td>${esc(r.gap || "—")}</td><td><em class="${r.status === "close" ? "close" : r.status}">${esc(r.statusText)}</em></td>${stretch ? `<td>${esc(r.stretchTarget || "—")}</td>` : ""}<td>${r.scored === false ? "—" : esc(ver)}</td></tr>`).join("");
    return `<section class="lvl-msum" aria-label="Where you stand">
        <p class="lvl-pill-h">Where you stand</p>
        <div class="lvl-ptable-wrap"><table class="lvl-ptable lvl-where"><thead><tr><th scope="col">Metric</th><th scope="col">You</th><th scope="col">${esc(anchor.short)}</th><th scope="col">Gap</th><th scope="col">Status</th>${stretch ? `<th scope="col">${esc(stretch.short)}</th>` : ""}<th scope="col">Verification</th></tr></thead><tbody>${body}</tbody></table></div>
        <p class="lvl-legend"><span class="ok">Meets</span><span class="close">Within one step</span><span class="below">Below</span><span class="na">Not scored</span></p>
        ${(notes || []).map(n => `<p class="lvl-msum-k">${esc(n)}</p>`).join("")}
      </section>`;
  }
  function prioritiesSection(fit, extra) {
    const lv = fit.levels.find(l => l.key === fit.focusLevel);
    const items = fit.priorities.map((p, k) => `<li><div class="lvl-prio-h"><b>${k + 1}. ${esc(p.label)}</b><span>${esc(p.current)} → ${esc(p.target)}</span></div>
        <p>${p.gap != null ? `Gap: ${esc(p.gapText)}${p.impact != null && p.impact > 0 ? `. Reaching it adds about ${p.impact} points at ${esc(lv.short)}.` : "."}` : ""}${p.gap != null && !p.meaningful ? " That's inside normal measurement error, so it may already be there on a retest." : ""}</p>
        <p><b>Why it matters:</b> ${esc(p.why)}</p><p><b>Next step:</b> ${esc(p.action)}</p></li>`).join("");
    return `<section class="lvl-msum" aria-label="Development priorities">
        <p class="lvl-pill-h">${fit.stretch ? "Your path to " + esc(lv.short) : "Your top priorities"}</p>
        ${items ? `<ol class="lvl-prio">${items}</ol>` : `<p class="lvl-msum-k">You meet every benchmark we can score at ${esc(lv.short)}. Get film and verified numbers in front of coaches.</p>`}
        <p class="lvl-msum-k">Ranked by how much each one matters for your position, how big the gap is and how much it moves your score. Goals are illustrative; a real plan should fit your age, training history, health and your coach's guidance.</p>
        ${extra || ""}
      </section>`;
  }
  function levelExplainSection(fit, M, catLabel) {
    const det = fit.levels.map(l => {
      if (l.score == null) return `<details class="lvl-lexp"><summary><b>${esc(l.label)}</b><span>Not scored</span></summary><p class="lvl-note-sm">Not enough benchmarked data for this level.</p></details>`;
      const parts = l.used.map(u => `<li>${esc(catLabel[u.key] || u.key)}: ${Math.round(u.score)} × ${Math.round(u.share * 100)}% = ${(u.score * u.share).toFixed(1)}</li>`).join("");
      const adj = l.adjustments.map(a => `<li>${esc(a.label)}: ${a.points}</li>`).join("");
      return `<details class="lvl-lexp" data-level="${l.key}"><summary><b>${esc(l.label)}</b><span>${l.display}/100 · ${esc(l.classification)}</span></summary>
        <ul class="lvl-list">${parts}<li>Weighted score: ${l.base != null ? l.base.toFixed(1) : l.score.toFixed(1)}</li>${adj}<li><b>Final: ${l.score.toFixed(1)}, shown as ${l.display}</b></li></ul>
        <p class="lvl-note-sm">${l.coreOk ? "Core benchmarks are reasonably met here." : "A core benchmark isn't reasonably met here, so this level can't be your primary target yet."}${l.provisional ? " JUCO weights are provisional." : ""} Categories with no score are left out and their weight is shared across the rest.</p></details>`;
    }).join("");
    return sec("lexp", "How each level's score is calculated", `<p class="lvl-note-sm">Scoring model ${esc(FC.MODEL_VERSION)}. The weights are Peach State Recruits' provisional settings, not published standards.</p>${det}`);
  }
  // Development outlook from saved results on this device (same primary position only).
  function outlookHtml(keys) {
    const p = state.progress;
    const hist = p ? p.hist.filter(e => e.primary === state.input.primary) : [];
    const lines = keys.map(([k, label, lower, unit]) => {
      const t = FC.trend(hist, k, lower); if (!t.enough) return "";
      const n = (v) => unit === "s" ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)} s` : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} ${unit}`;
      return `<li class="${t.direction === "improving" ? "ok" : t.direction === "declining" ? "below" : "na"}"><span>${esc(label)}</span><b>${esc(n(t.change))} over ${Math.round(t.days / 30.44)} months (${esc(n(t.perMonth))} a month): ${esc(t.direction)}</b></li>`;
    }).filter(Boolean);
    return `<section class="lvl-msum lvl-outlook" aria-label="Development outlook"><p class="lvl-pill-h">Development outlook</p>
      ${lines.length ? `<ul class="lvl-prog-d">${lines.join("")}</ul><p class="lvl-msum-k">Based on your saved results on this device. Past change doesn't predict future growth, and this never changes your score.</p>`
        : `<p class="lvl-msum-k">Insufficient progression data. Save at least two results, a month or more apart, to see your trend.</p>`}</section>`;
  }
  function whatIfOut(now, hyp, M) {
    const lv = (f) => f.levels.find(l => l.key === (f.primary || f.closest));
    const a = lv(now), b = lv(hyp);
    const name = (f, l) => f.primary ? l.label : "Further evaluation needed (closest: " + l.label + ")";
    const same = hyp.levels.find(l => l.key === a.key);
    const d = same.score != null && a.score != null ? Math.round(same.score) - Math.round(a.score) : 0;
    return `<p class="lvl-whatif-k">Hypothetical scenario. Not a forecast, and it doesn't change your saved result.</p>
      <ul class="lvl-whatif"><li><span>Current fit</span><b>${esc(name(now, a))}: ${a.display}/100</b><small>${esc(a.classification)}</small></li>
      <li><span>Hypothetical fit</span><b>${esc(name(hyp, b))}: ${b.display}/100</b><small>${esc(b.classification)}</small></li>
      <li><span>Change at ${esc(a.short)}</span><b>${d > 0 ? "+" + d : d} points</b><small>${same.classification === a.classification ? "Same classification" : esc(a.classification + " → " + same.classification)}</small></li></ul>
      <ul class="lvl-pwhat">${hyp.levels.map(l => { const was = now.levels.find(x => x.key === l.key); if (l.score == null) return `<li><b>${esc(l.short)}</b><span>—</span></li>`; const dl = was.score == null ? 0 : l.display - was.display; return `<li><b>${esc(l.short)}</b><span>${l.display}</span><small class="${dl > 0 ? "up" : dl < 0 ? "down" : ""}">${dl > 0 ? "+" + dl : dl < 0 ? dl : "no change"}</small></li>`; }).join("")}</ul>`;
  }

  // ----- Pitchers -----
  const P_STEP = { sit: 1, peak: 1, strikePct: 2, bb9: 0.5, kbb: 0.5, era: 0.5, whip: 0.1, k9: 1 };
  function pVal(k, v) {
    if (v == null) return "—";
    if (k === "sit" || k === "peak") return v + " mph";
    const p = PF.PERF[k]; return p ? p.fmt(v) : String(v);
  }
  function pTarget(k, key, hand) {
    if (k === "sit" || k === "peak") { const r = PF.VELO[hand][k][key]; return r[0] + "–" + r[1] + (key === "p4" || key === "juco" ? "+" : "") + " mph"; }
    const p = PF.PERF[k], t = p.t[key]; if (t == null) return "Varies";
    return (p.dir === "lower" ? "under " : "") + p.fmt(t) + (p.dir === "higher" ? "+" : "");
  }
  function pitcherWhereRows(fit, anchor, stretch) {
    const hand = fit.hand;
    const rows = anchor.veloRows.map(r => {
      const gap = Math.max(0, r.range[0] - r.value), ok = gap === 0;
      return { label: r.label, you: r.value + " mph", target: pTarget(r.key, anchor.key, hand), stretchTarget: stretch ? pTarget(r.key, stretch.key, hand) : null,
        gap: ok ? "" : Math.round(gap * 10) / 10 + " mph", status: ok ? "ok" : gap <= P_STEP[r.key] ? "close" : "below", statusText: ok ? (r.value >= r.range[1] ? "Above range" : "In range") : gap <= P_STEP[r.key] ? "Close" : "Below" };
    }).concat(anchor.cmdRows.concat(anchor.perfRows).map(r => {
      const p = PF.PERF[r.key];
      if (r.meets == null) return { label: p.label, you: pVal(r.key, r.value), target: "Varies", stretchTarget: stretch ? pTarget(r.key, stretch.key, hand) : null, gap: "", status: "na", statusText: "Not scored here", scored: false };
      const gap = Math.abs(r.value - r.target);
      return { label: p.label, you: pVal(r.key, r.value), target: pTarget(r.key, anchor.key, hand), stretchTarget: stretch ? pTarget(r.key, stretch.key, hand) : null,
        gap: r.meets ? "" : p.fmt(gap).replace("%", " pts"), status: r.meets ? "ok" : gap <= P_STEP[r.key] ? "close" : "below", statusText: r.meets ? "Meets" : gap <= P_STEP[r.key] ? "Close" : "Below" };
    }));
    const d = fit.derived, extra = [["First-pitch strike %", d.fpsPct], ["Zone %", d.zonePct], ["K-BB%", d.kbbPct]].filter(x => x[1] != null);
    return rows.concat(extra.map(([l, v]) => ({ label: l, you: v + "%", target: "No benchmark", gap: "", status: "na", statusText: "Shown only", scored: false })));
  }
  function pitcherInfoHtml(fit) {
    const sp = fit.info.secondary, ch = fit.info.characteristics;
    if (!sp.length && !ch.length) return "";
    const f = (v, u) => v == null ? "" : v + (u || "");
    return `<section class="lvl-msum" aria-label="Secondary pitches and pitch data"><p class="lvl-pill-h">Secondary pitches and pitch data</p>
      ${sp.length ? `<ul class="lvl-badges lvl-pitches">${sp.map(p => `<li><b>${esc(p.type)}</b><span>${esc([f(p.avg, " mph avg"), f(p.max, " mph max"), f(p.spin, " rpm"), f(p.ivb, " in IVB"), f(p.hb, " in HB"), f(p.whiff, "% whiff"), f(p.usage, "% usage")].filter(Boolean).join(" · ") || "No measurements entered")}</span></li>`).join("")}</ul>` : ""}
      ${ch.length ? `<ul class="lvl-list">${ch.map(c => `<li>${esc(c.label)}: ${esc(c.value + " " + c.unit)}</li>`).join("")}</ul>` : ""}
      <p class="lvl-msum-k">Shown, not scored. Pitch quality depends on shape, velocity separation, arm slot and release together, and there's no reliable single-number benchmark for it yet.${fit.secondaryNotes && fit.secondaryNotes.expect ? " What coaches expect here: " + esc(fit.secondaryNotes.expect.breaking.toLowerCase()) + "." : ""}</p></section>`;
  }
  function pitcherBoard(read, fit, idx) {
    const i = state.input, handLabel = fit.hand === "L" ? "LHP" : "RHP";
    const head = fitHead(read, idx, `${handLabel} · Class of ${i.gradYear}`);
    if (!fit.enough) return `<div class="lvl-board lvl-pboard">${head}<section class="lvl-match"><p class="lvl-pill-h">Your pitcher evaluation</p><p class="lvl-match-need">${esc(fit.message)}</p></section></div>`;
    const anchor = fit.levels.find(l => l.key === (fit.primary || fit.closest)), stretch = fit.stretch ? fit.levels.find(l => l.key === fit.stretch) : null;
    const notes = [];
    if (anchor.sampleWeight < 1) notes.push(`Small sample (${fit.derived.ip} IP): your stats count ${Math.round(anchor.sampleWeight * 100)}% toward command and game performance, and the rest is held at a neutral score. Full weight starts at 20 innings.`);
    const comp = (COMPETITION.find(c => c[0] === i.metrics.pCompetition) || [])[1];
    notes.push(comp ? `Stats are against ${comp.toLowerCase()} competition. They're scored at face value; a coach will weigh who you faced.` : "Stats are taken at face value. Strikeouts against weak competition mean less than fewer strikeouts against ranked teams, so a coach will adjust for who you faced. Add your level of competition above.");
    return `<div class="lvl-board lvl-pboard">${head}
        ${matchSection(fit, PF)}
        ${standoutsSection(fit)}
        ${categoriesSection(fit, anchor, `Measured against ${anchor.label} expectations. Fastball velocity carries the most weight, and your sitting velocity counts three times as much as your peak. A sitting fastball below a level's range also takes points off there.`)}
        ${confidenceSection(fit.confidence)}
        ${whereSection(pitcherWhereRows(fit, anchor, stretch), anchor, stretch, fit.confidence, notes)}
        ${pitcherInfoHtml(fit)}
        ${prioritiesSection(fit, fit.classContext ? `<p class="lvl-pclass">${esc(fit.classContext.text)}</p>` : "")}
        ${outlookHtml([["typFb", "Sitting fastball", false, "mph"], ["maxFb", "Peak fastball", false, "mph"]])}
        <p class="pro-source-note">Ranges: ${esc(PF.SOURCE.name)} v${esc(PF.SOURCE.version)} (${esc(PF.SOURCE.asOf)}). ${esc(PF.SOURCE.note)} Scoring weights are Peach State Recruits' provisional settings (model ${esc(FC.MODEL_VERSION)}).</p>
      </div>`;
  }
  function pitcherWhatIfHtml(idx, fit) {
    if (!fit.enough) return "";
    const d = fit.derived;
    const f = [["typFb", "Sitting fastball", "mph", d.sit], ["maxFb", "Peak fastball", "mph", d.peak], ["strikePct", "Strike %", "%", d.strikePct], ["bb9", "BB/9", "", d.bb9], ["k9", "K/9", "", d.k9], ["era", "ERA", "", d.era]];
    return `<details class="pro-scenario no-print" open><summary>What if my numbers change?</summary><p>Try goal numbers and see how your level scores move. Your real result stays the same. This is a hypothetical, not a forecast, and improving a few numbers doesn't guarantee recruitment.</p>
      <div class="pro-scenario-inputs">${f.map(([k, l, u, v]) => `<label>${esc(l)}${u ? ` (${esc(u)})` : ""}<input class="input" type="number" inputmode="decimal" step="0.1" data-pwhat="${idx}:${k}" value="${v ?? ""}"></label>`).join("")}</div>
      <button class="btn btn-line" type="button" data-run-pwhat="${idx}">See my hypothetical scores</button><div id="pwhatOut${idx}" role="status"></div></details>`;
  }
  function runPitcherWhatIf(idx) {
    const m = Object.assign({}, state.input.metrics), out = document.getElementById("pwhatOut" + idx);
    app.querySelectorAll(`[data-pwhat^="${idx}:"]`).forEach(el => { const k = el.dataset.pwhat.split(":")[1]; const v = el.value === "" ? null : Number(el.value); if (v != null && !isFinite(v)) return; m[k] = v; });
    // Typed per-9 rates replace the season totals they came from.
    if (m.k9 != null || m.bb9 != null) { m.so = null; m.bb = null; }
    const now = pitcherFit(), hyp = PF.evaluate(Object.assign({}, state.input, { metrics: m }), { bbVelo: m.bbVelo, chVelo: m.chVelo });
    if (!hyp.enough) { out.innerHTML = `<p class="lvl-note-sm">Enter a fastball velocity to compare.</p>`; return; }
    out.innerHTML = whatIfOut(now, hyp, PF);
  }
  function pitcherLevelsGuide(fit) {
    const P = PF.PRIORITIES;
    const keys = PF.LEVELS.map(l => l.key);
    return `<div class="lvl-ptable-wrap"><table class="lvl-ptable lvl-ptable-light"><thead><tr><th scope="col">What coaches weigh</th>${PF.LEVELS.map(l => `<th scope="col">${esc(l.short)}</th>`).join("")}</tr></thead><tbody>${P.rows.map((r, j) => `<tr><th scope="row">${esc(r)}</th>${keys.map(k => `<td>${esc(P[k][j])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <h4>Secondary pitches by level</h4><ul class="lvl-list">${PF.LEVELS.map(l => `<li><b>${esc(l.short)}:</b> ${esc(PF.SECONDARY[l.key].breaking)}. Changeup: ${esc(PF.SECONDARY[l.key].change.toLowerCase())}.</li>`).join("")}</ul>
      <p class="lvl-note-sm">An 88 mph fastball with an outstanding slider can draw more interest than 91 mph with no dependable secondary pitch. Secondary pitches are judged on video and movement, so they aren't scored here yet.</p>
      <h4>What coaches look for physically</h4><ul class="lvl-list">${PF.LEVELS.map(l => `<li><b>${esc(l.short)}:</b> ${esc(PF.PHYSICAL[l.key])}.</li>`).join("")}</ul>
      <p class="lvl-note-sm">There's no minimum height or weight for any level. A 5'10" pitcher with velocity, command and movement can be a real D1 prospect.</p>
      <h4>Spin, break and extension</h4><p class="lvl-note-sm">No single spin or break number makes a good fastball. A four-seamer can win with lots of ride, a sinker with less ride and more run, and a low slot with a different approach angle. These are read next to your pitch type, velocity, hand and release, never against one cutoff.</p>`;
  }
  function pitcherReadHtml(read, idx) {
    const fit = pitcherFit();
    const ak = fit.enough ? fit.primary || fit.closest : null, ai = LADDER.indexOf(ak);
    const at = ak ? [ak].concat(ai >= 0 && ai < 5 ? [LADDER[ai + 1]] : []) : [];
    const q = at.length ? "bands=" + encodeURIComponent(at.join(",")) + "&" : "";
    const grad = state.input.gradYear ? "grad=" + encodeURIComponent(state.input.gradYear) + "&" : "";
    const where = at.length ? at.map(k => PF.LEVELS.find(l => l.key === k).short).join(" · ") : "Every level's";
    const taps = `<section class="lvl-onetap no-print" aria-label="Your next steps">
      <p class="lvl-cta2-t">Your next steps</p>
      <div class="lvl-onetap-grid">
        <button class="lvl-tap lvl-tap-main" type="button" data-email-handoff="${idx}"><b>Email a coach</b><span>A personal email with your real metrics</span></button>
        <a class="lvl-tap" href="colleges.html?${q}from=fml"><b>${at.length ? "Schools at your level" : "Explore schools"}</b><span>${esc(where)} programs</span></a>
        <a class="lvl-tap" href="camps.html?${q}${grad}from=fml"><b>${at.length ? "Camps for your level" : "Explore camps"}</b><span>Upcoming college camps</span></a>
        <a class="lvl-tap" href="my-recruiting.html?from=fml#profile"><b>Save to My Recruiting</b><span>Your metrics, schools and follow-ups</span></a>
      </div>
      <p class="lvl-note-sm">School and camp lists are filtered by level only. They don't rate how you fit any specific school.</p>
    </section>`;
    const compare = `<p class="lvl-note-sm">These are averages of researched groups, not pass/fail lines. Being below an average doesn't rule you out. Each group is kept separate.</p>
      ${read.panels.map(panelHtml).join("")}${collegeHtml(read.college)}${idx === 0 ? advancedHtml() : ""}`;
    return `<section class="lvl-read" aria-labelledby="read${idx}" data-read="${idx}">
      ${pitcherBoard(read, fit, idx)}
      ${pitcherWhatIfHtml(idx, fit)}
      ${picksHtml(at, idx)}
      ${taps}
      <div class="lvl-likeyou no-print" data-likeyou="${idx}" hidden></div>
      <div class="lvl-share no-print"><button class="btn btn-line" type="button" data-share="${idx}">Share my result</button><div class="lvl-share-out" id="shareOut${idx}" hidden></div></div>
      ${numbersStrip(read)}
      ${fit.enough ? levelExplainSection(fit, PF, PF.CAT_LABEL) : ""}
      ${sec("plevels", "What each level looks for in a pitcher", pitcherLevelsGuide(fit))}
      ${sec("age-frame", "Same-grade, height and weight context", youngHtml(read, idx) + frameHtml(read, idx))}
      ${crossCheckHtml(read)}
      ${sec("compare", "How you compare with committed players", compare)}
    </section>`;
  }

  // ----- Position players -----
  const tFmt = (t, v) => v == null ? "—" : t.unit === "seconds" ? v.toFixed(2) + " s" : v + " mph";
  const tTarget = (x) => x && x.threshold != null ? (x.unit === "seconds" ? x.threshold.toFixed(2) + " s or faster" : x.threshold + "+ mph") + (x.estimated ? "*" : "") : "No target";
  function positionWhereRows(fit, anchor, stretch) {
    const rows = anchor.tools.map(t => {
      const st = stretch ? stretch.tools.find(x => x.tool === t.tool) : null;
      const step = t.unit === "seconds" ? (/pop/i.test(t.metric || "") ? 0.05 : 0.1) : 1;
      if (t.threshold == null) return { label: t.label, you: tFmt(t, t.value), target: "No target", stretchTarget: null, gap: "", status: "na", statusText: "No benchmark", scored: false };
      if (t.value == null) return { label: t.label, you: "Not entered", target: tTarget(t), stretchTarget: tTarget(st), gap: "", status: "na", statusText: "Not entered", scored: false };
      const gap = Math.abs(t.value - t.threshold);
      return { label: t.label, you: tFmt(t, t.value), target: tTarget(t), stretchTarget: stretch ? tTarget(st) : null,
        gap: t.meets ? "" : t.unit === "seconds" ? gap.toFixed(2) + " s" : Math.round(gap * 10) / 10 + " mph",
        status: t.meets ? "ok" : gap <= step + 1e-9 ? "close" : "below", statusText: t.meets ? "Meets" : gap <= step + 1e-9 ? "Close" : "Below" };
    });
    const s = fit.stats, m = state.input.metrics;
    const r3 = (v) => L.fmt(v, "ratio");
    [["Batting average", s.avg, r3], ["On-base %", s.obp, r3], ["Slugging", s.slg, r3], ["OPS", s.ops, r3], ["ISO", s.iso, r3], ["K%", s.kPct, v => v + "%"], ["BB%", s.bbPct, v => v + "%"]]
      .filter(x => x[1] != null).forEach(([l, v, f]) => rows.push({ label: l, you: f(v), target: "No benchmark", gap: "", status: "na", statusText: "Shown only", scored: false }));
    [["Bat speed", m.batSpeed], ["Average exit velocity", m.avgEv]].filter(x => x[1] != null).forEach(([l, v]) => rows.push({ label: l, you: v + " mph", target: "No benchmark", gap: "", status: "na", statusText: "Shown only", scored: false }));
    return rows;
  }
  function positionBoard(read, fit, idx) {
    const i = state.input;
    const head = fitHead(read, idx, `${read.position} · Class of ${i.gradYear}`);
    if (!fit.enough) return `<div class="lvl-board lvl-pboard">${head}<section class="lvl-match"><p class="lvl-pill-h">Your recruiting evaluation</p><p class="lvl-match-need">${esc(fit.message)}</p></section></div>`;
    const anchor = fit.levels.find(l => l.key === (fit.primary || fit.closest)), stretch = fit.stretch ? fit.levels.find(l => l.key === fit.stretch) : null;
    const est = anchor.tools.concat(stretch ? stretch.tools : []).some(t => t.estimated);
    const notes = [];
    if (est) notes.push("* Estimated target: no source publishes this one, so it's set from the published targets around it.");
    if (fit.stats.any) notes.push(`Game stats are shown but don't change the score. A strong OPS means more against good pitching, so a coach adjusts for who you faced.${fit.stats.pa != null ? " Sample: " + fit.stats.sample.label.toLowerCase() + "." : ""}`);
    const cls = PF ? PF.classContext(i.gradYear) : null;
    const tk = read.family === "C" ? "pop" : read.family === "OF" ? "ofVelo" : "ifVelo";
    return `<div class="lvl-board lvl-pboard">${head}
        ${matchSection(fit, QF)}
        ${standoutsSection(fit)}
        ${categoriesSection(fit, anchor, `Measured against ${anchor.label} targets. What matters most for your position: ${fit.focus.toLowerCase()}. Each category is scored only from metrics that have a published benchmark.`)}
        ${confidenceSection(fit.confidence)}
        ${whereSection(positionWhereRows(fit, anchor, stretch), anchor, stretch, fit.confidence, notes)}
        ${prioritiesSection(fit, cls ? `<p class="lvl-pclass">${esc(cls.text)}</p>` : "")}
        ${outlookHtml([["maxEv", "Max exit velocity", false, "mph"], ["sixty", "60-yard dash", true, "s"], [tk, read.family === "C" ? "Pop time" : "Throwing velocity", read.family === "C", read.family === "C" ? "s" : "mph"]])}
        <p class="pro-source-note">Targets: <a href="https://www.nextcommit.ai/downloads/college-baseball-recruiting-standards-by-division.pdf" target="_blank" rel="noopener">NextCommit</a>, with gaps filled from NextCommit's catcher page, TP College Showcase, Uncommitted University, GoBig Recruiting and NCSA. The scoring weights are Peach State Recruits' provisional model for your position (model ${esc(FC.MODEL_VERSION)}).</p>
      </div>`;
  }
  function positionWhatIfHtml(read, idx, fit) {
    if (!fit.enough) return "";
    const m = state.input.metrics, tk = read.family === "C" ? "pop" : read.family === "OF" ? "ofVelo" : "ifVelo";
    const f = [["maxEv", "Max exit velocity", "mph", m.maxEv], ["sixty", "60-yard dash", "s", m.sixty], [tk, read.family === "C" ? "Pop time" : "Throwing velocity", read.family === "C" ? "s" : "mph", m[tk]]];
    return `<details class="pro-scenario no-print" open><summary>What if my numbers change?</summary><p>Try goal numbers and see how your level scores move. Your real result stays the same. This is a hypothetical, not a forecast, and improving a few numbers doesn't guarantee recruitment.</p>
      <div class="pro-scenario-inputs">${f.map(([k, l, u, v]) => `<label>${esc(l)} (${esc(u)})<input class="input" type="number" inputmode="decimal" step="${u === "s" ? "0.01" : "0.5"}" data-qwhat="${idx}:${k}" value="${v ?? ""}"></label>`).join("")}</div>
      <button class="btn btn-line" type="button" data-run-qwhat="${idx}">See my hypothetical scores</button><div id="qwhatOut${idx}" role="status"></div></details>`;
  }
  function runPositionWhatIf(idx) {
    const read = state.result.reads[idx], out = document.getElementById("qwhatOut" + idx), patch = {};
    app.querySelectorAll(`[data-qwhat^="${idx}:"]`).forEach(el => { const k = el.dataset.qwhat.split(":")[1]; patch[k] = el.value === "" ? null : Number(el.value); });
    const now = QF.evaluate(read, state.input), hyp = QF.evaluate(QF.withValues(read, patch), state.input);
    if (!hyp.enough) { out.innerHTML = `<p class="lvl-note-sm">${esc(hyp.message)}</p>`; return; }
    out.innerHTML = whatIfOut(now, hyp, QF);
  }
  function positionReadHtml(read, idx) {
    const fit = QF.evaluate(read, state.input);
    const ak = fit.enough ? fit.primary || fit.closest : null, ai = LADDER.indexOf(ak);
    const at = ak ? [ak].concat(ai >= 0 && ai < 5 ? [LADDER[ai + 1]] : []) : [];
    const q = at.length ? "bands=" + encodeURIComponent(at.join(",")) + "&" : "";
    const grad = state.input.gradYear ? "grad=" + encodeURIComponent(state.input.gradYear) + "&" : "";
    const where = at.length ? at.map(k => QF.LEVELS.find(l => l.key === k).short).join(" · ") : "Every level's";
    const compare = `<p class="lvl-note-sm">These are averages of researched groups, not pass/fail lines. Being below an average doesn't rule you out. Each group is kept separate.</p>
      ${read.panels.map(panelHtml).join("")}${collegeHtml(read.college)}${idx === 0 ? advancedHtml() : ""}`;
    return `<section class="lvl-read" aria-labelledby="read${idx}" data-read="${idx}">
      ${positionBoard(read, fit, idx)}
      ${positionWhatIfHtml(read, idx, fit)}
      ${picksHtml(at, idx)}
      ${fit.enough ? levelExplainSection(fit, QF, QF.CAT_LABEL) : ""}
      <section class="lvl-onetap no-print" aria-label="Your next steps">
        <p class="lvl-cta2-t">Your next steps</p>
        <div class="lvl-onetap-grid">
          <button class="lvl-tap lvl-tap-main" type="button" data-email-handoff="${idx}"><b>Email a coach</b><span>A personal email with your real metrics</span></button>
          <a class="lvl-tap" href="colleges.html?${q}from=fml"><b>${at.length ? "Schools at your level" : "Explore schools"}</b><span>${esc(where)} programs</span></a>
          <a class="lvl-tap" href="camps.html?${q}${grad}from=fml"><b>${at.length ? "Camps for your level" : "Explore camps"}</b><span>Upcoming college camps</span></a>
          <a class="lvl-tap" href="my-recruiting.html?from=fml#profile"><b>Save to My Recruiting</b><span>Your metrics, schools and follow-ups</span></a>
        </div>
        <p class="lvl-note-sm">School and camp lists are filtered by level only. They don't rate how you fit any specific school.</p>
      </section>
      <div class="lvl-likeyou no-print" data-likeyou="${idx}" hidden></div>
      <div class="lvl-share no-print"><button class="btn btn-line" type="button" data-share="${idx}">Share my result</button><div class="lvl-share-out" id="shareOut${idx}" hidden></div></div>
      ${numbersStrip(read)}
      ${sec("age-frame", "Same-grade, height and weight context", youngHtml(read, idx) + frameHtml(read, idx))}
      ${crossCheckHtml(read)}
      ${sec("compare", "How you compare with committed players", compare)}
    </section>`;
  }

  function results() {
    const r = state.result, i = state.input;
    const ctx = [];
    if (i.heightIn != null) ctx.push(`${Math.floor(i.heightIn / 12)}'${i.heightIn % 12}"`);
    if (i.weightLb != null) ctx.push(`${i.weightLb} lb`);
    const tab = Math.min(state.tab || 0, r.reads.length - 1);
    const tabs = r.reads.length > 1 ? `<div class="lvl-tabs" role="tablist" aria-label="Results by position">${r.reads.map((rd, k) => `<button type="button" role="tab" id="tab${k}" aria-controls="tp${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-tab="${k}">${esc(U.tabLabel(rd))}</button>`).join("")}</div>` : "";
    const rule = `A level shows "Meets targets" only when at least ${CFG.HIGHLIGHT_RULE.minDistinctCoreTools} different core tools have published targets there and every compared tool meets its target. For pitchers, it's when your fastball meets the listed velocity target. This is a product rule, not a validated prediction.`;
    const how = `<p><b>Evidence policy:</b> NCAA rules are used for timing, MLB for definitions, NCSA for a separate guideline check, and the named original publishers for their own targets and samples. No offer odds, percentiles or growth forecasts are calculated.</p><p>We compare each metric you enter with the published recruiting targets for your position at each level, using the edge of each published band as a provisional line. Averages of researched groups and college-player metrics are shown separately and never change a level's status.</p>
      <p>A match percentage is the share of the metrics you entered that meet that level's existing published target. Only metrics with a published target are counted. Height and weight are not counted and do not change the percentage. If too few metrics were entered, we say so instead of showing a percentage. The percentage does not change a level's status.</p>
      <p><b>The rule used.</b> ${esc(rule)}</p>
      <ul class="lvl-list"><li><b>Meets targets:</b> passes the rule above.</li><li><b>Close:</b> at least one of your compared metrics meets that level's target and at least one is below it.</li><li><b>Below targets:</b> your compared metrics are all below that level's targets.</li><li><b>Needs more metrics:</b> targets exist, but too few of your metrics could be compared there.</li><li><b>Estimated target:</b> no source publishes this one, so it's set from the published targets right around it. The card says exactly how.</li></ul>
      <p><b>Your headline</b> is the first level in the list that shows "Meets targets". <b>Next step</b> is the nearest level above it with a metric below target, showing only that level's smallest gap relative to its target.</p>
      <h4>Notes on your results</h4><ul class="lvl-list">${r.reads.map(rd => rd.highlight.explain.map(e => `<li>${ds(e)}</li>`).join("")).join("")}</ul>
      <h4>Limitations</h4>
      <p>${esc(r.note)}</p>
      <ul class="lvl-list">${r.evidence.map(e => `<li>${ds(e.text)}</li>`).join("")}${r.stage.map(s => `<li>${ds(s)}</li>`).join("")}</ul>
      <h4>Missing information</h4>
      ${r.missing.length ? `<p><b>Not entered:</b> ${esc(r.missing.join(", "))}. Adding these can make the comparison more complete.</p>` : `<p>All core metrics for your position${r.reads.length > 1 ? "s" : ""} were entered.</p>`}
      ${i.meta.link ? `<p class="lvl-note-sm">Reference link: <span class="lvl-link">${esc(i.meta.link)}</span></p>` : ""}`;
    const addSrc = (state.add && state.add.sources || []).filter(s => s.id !== "PBR_WI_E");
    const sources = `<div class="lvl-legend" aria-label="Legend"><span class="lvl-kind guide">Published target</span> NextCommit recruiting guideline (used for level status). Where NextCommit lists no target, a published target from NextCommit's catcher page, TP College Showcase, Uncommitted University, GoBig Recruiting or NCSA fills it; the few with no published value anywhere are marked "Estimated target" with how they were set <span class="lvl-kind ref">Second source</span> NCSA guideline, shown for reference <span class="lvl-kind mean">Average</span> sample mean of a researched group <span class="lvl-kind ctx">College players</span> college norms, context only</div>
      <p class="lvl-note-sm">Benchmark data v${esc(r.dataVersion)}, research as of ${esc(r.researchAsOf)}. ${esc(r.interpretationNote)}</p>
      <h4>Rules, definitions and recruiting education</h4><ul class="lvl-list">${Research.sources.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b></a> · ${esc(x.kind)}. ${esc(x.use)} <span>${esc(x.limit)}</span></li>`).join("")}</ul><p class="lvl-note-sm">Research checked ${esc(Research.checked)}. A linked source does not endorse this tool.</p>
      <h4>Original benchmark publishers</h4><ul class="lvl-list">${state.data.sources.filter(s => ["NC", "NCC", "NS", "TP", "UU", "GB", "EST", "BP", "FG", "SL", "PC", "SEC"].includes(s.id)).map(s => `<li><b>${esc(s.publisher)}</b> (${esc(s.evidence_type)}, ${esc(s.publication_or_check)}): ${esc(s.limitation)} <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a></li>`).join("")}</ul>
      ${addSrc.length ? `<h4>v2 context sources (never change your level)</h4><ul class="lvl-list">${addSrc.map(s => `<li><b>${esc(s.publisher)}</b>, ${esc(s.title)} (${esc(s.evidence_type)}): ${esc(s.limitation)} <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a></li>`).join("")}</ul>` : ""}
      ${state.size ? `<h4>Height and weight study (context only)</h4><ul class="lvl-list"><li><b>Peach State Recruits</b>, college roster sample (751 players, 20 rosters, official school roster pages, Nov 2026). ${esc(state.size.college_roster_sample.limitations)} <a href="${esc(CFG.SIZE_CSV_URL)}" download>Download the roster rows (CSV)</a></li><li><b>Slammers</b> and <b>Flatground</b> committed high school player heights and weights, from the reports listed above.</li></ul>` : ""}
      ${state.add && state.add.landscape_facts ? `<h4>The landscape</h4><ul class="lvl-list">${state.add.landscape_facts.map(f => `<li>${esc(f.fact)}${f.url ? ` <a href="${esc(f.url)}" target="_blank" rel="noopener">Source</a>` : ""}</li>`).join("")}</ul>` : ""}
      ${state.add && state.add.measurement_notes ? `<h4>Measurement notes</h4><ul class="lvl-list">${state.add.measurement_notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <p class="lvl-note-sm">"Committed players' best showcase results" is BaseballPath. "Outfielders during or after their junior season" is Flatground. "Rising-senior summer group" is Slammers. College pitchers' fastballs come from Pitching Coach U and an SEC research sample.</p>`;
    return `<div class="lvl-results">
      <p class="lvl-sub lvl-res-meta">${esc(positions().join(" / "))} · Class of ${esc(i.gradYear)} · Throws ${esc(i.throws)} · Bats ${esc(i.bats)}${ctx.length ? ` · ${esc(ctx.join(", "))}` : ""}</p>
      ${tabs}
      ${r.reads.map((rd, k) => `<div class="lvl-tabpanel" id="tp${k}"${r.reads.length > 1 ? ` role="tabpanel" aria-labelledby="tab${k}"` : ""}${k === tab ? "" : " hidden"}>${readHtml(rd, k)}</div>`).join("")}
      ${r.twoWay ? `<p class="lvl-note-sm">Two-way player: pitching and position play are compared separately and never blended into one result.</p>` : ""}
      ${reviewHtml()}
      <div class="lvl-res-actions no-print"><button class="btn btn-line" type="button" data-go="1">Update my metrics</button><button class="btn btn-line" type="button" data-print>Print</button><button class="btn btn-line" type="button" data-reset>Start over</button></div>
      <details class="lvl-more" data-more="g"><summary><b>Recruiting timeline, saved results and sources</b><span>Your recruiting clock, progress since last time, how this works</span></summary><div class="lvl-more-b">
      ${clockHtml()}
      ${progressHtml()}
      ${sec("sources", "Sources", sources)}
      ${sec("how", "How this works", how)}
      </div></details>
      ${printHtml()}
      <div class="lvl-card lvl-cta no-print"><div><h3>Want coaches to see your film?</h3><p>Peach State Recruits builds Instagram features, highlight videos and recruiting profiles for baseball players.</p></div><a class="btn btn-peach btn-lg" href="index.html#packages">See packages</a></div>
    </div>`;
  }

  // ---------- Share image (drawn in the browser; nothing is uploaded) ----------
  let logoImg = null;
  const loadLogo = () => logoImg || (logoImg = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = "images/logo.png"; }));
  function wrap(ctx, text, maxW) {
    const words = text.split(" "), lines = []; let line = "";
    words.forEach(w => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  // The same fit the results board shows (v3), so the share image and the tracked level always match the page.
  function primaryOf(read) {
    try {
      const fit = read.kind === "pitching" ? pitcherFit() : QF.evaluate(read, state.input);
      if (!fit || !fit.primary) return null;
      const l = fit.levels.find(x => x.key === fit.primary);
      return l ? { key: l.key, label: l.label, score: l.display } : null;
    } catch (_) { return null; }
  }
  // Short summary of the latest result for Start Here (and future pages). This device only.
  const SUMMARY_KEY = "psr_level_summary_v1";
  let acctStatus = "";
  // One line under the level board: saved to the account, or sign in to keep it on any device.
  function paintAcct() {
    app.querySelectorAll(".lvl-acct-line").forEach(p => {
      p.innerHTML = acctStatus === "saved" ? `<b>Saved to your account.</b> It's in <a href="my-recruiting.html">My Recruiting</a> and on any device you sign in on.`
        : acctStatus === "saving" ? "Saving…"
        : `<a href="my-recruiting.html#signin"><b>Sign in or create a free account</b></a> to keep this result on any device. It's saved on this one either way.`;
    });
  }
  // Welcome back: reopen the last result (this device, or the account when signed in).
  function welcomeHtml() {
    const s = state.saved;
    if (!s || !s.input || state.result || state.welcomeClosed) return "";
    const lv = s.level, d = new Date(s.t), when = isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<section class="lvl-welcome" aria-label="Your last result"><p class="lvl-welcome-k">Welcome back</p>
      <p class="lvl-welcome-r">${lv ? `<b>${esc(lv.label)}</b> ${esc(lv.score)}/100` : "<b>Your last result</b>"}<span>${esc([s.position ? s.position.charAt(0).toUpperCase() + s.position.slice(1) : "", when].filter(Boolean).join(", "))}</span></p>
      <div class="lvl-welcome-b"><button class="btn btn-peach" type="button" data-reopen>See my results</button><button class="btn btn-line" type="button" data-fresh>Start fresh</button></div></section>`;
  }
  function reopenSaved() {
    const s = state.saved; if (!s || !s.input || !state.data) return;
    state.input = JSON.parse(JSON.stringify(s.input)); state.raw = Object.assign({}, s.raw || {});
    state.result = L.evaluate(state.data, state.input); state.step = 4; state.tab = 0; acctStatus = s.synced ? "saved" : acctStatus;
    render(); window.scrollTo(0, 0);
  }
  function saveSummary() {
    try {
      const read = state.result && state.result.reads && state.result.reads[0];
      if (!read) return;
      const fit = read.kind === "pitching" ? pitcherFit() : QF.evaluate(read, state.input);
      const ak = fit && fit.enough ? fit.primary || fit.closest : null, ai = LADDER.indexOf(ak);
      const lv = ak ? fit.levels.find(l => l.key === ak) : null;
      const summary = {
        v: 1, t: new Date().toISOString(), position: U.POS[read.position] || read.position, gradYear: state.input.gradYear || null,
        level: lv ? { key: lv.key, label: lv.label, short: lv.short, score: lv.display, primary: !!fit.primary } : null,
        bands: ak ? [ak].concat(ai >= 0 && ai < 5 ? [LADDER[ai + 1]] : []) : [],
        handoff: (() => { try { return R.handoff(state.input, read); } catch (_) { return null; } })(),
        input: JSON.parse(JSON.stringify(state.input)), raw: Object.assign({}, state.raw)
      };
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
      state.saved = summary;
      acctStatus = "saving";
      if (window.PSRLevelSync) window.PSRLevelSync.save(summary).then(ok => { acctStatus = ok ? "saved" : "signedout"; paintAcct(); }).catch(() => { acctStatus = "signedout"; paintAcct(); });
      else acctStatus = "signedout";
    } catch (_) {}
  }
  function shareSite() {
    try { return window.PSR.displayUrl(window.PSR.siteBase()).replace(/\/$/, ""); } catch (_) { return "peachstaterecruits"; }
  }
  async function storyBlob(read) {
    try { await Promise.all(["120px Anton", "700 60px 'Barlow Condensed'", "600 40px Inter"].map(f => document.fonts && document.fonts.load(f))); } catch (e) { /* fonts optional */ }
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), i = state.input, m = i.metrics, h = U.headline(read);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0d1526"); g.addColorStop(1, "#070b14"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const rg = x.createRadialGradient(900, 160, 0, 900, 160, 900); rg.addColorStop(0, "rgba(255,138,76,.30)"); rg.addColorStop(1, "rgba(255,138,76,0)"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    const logo = await loadLogo(); if (logo) x.drawImage(logo, W / 2 - 150, 120, 300, 300);
    x.fillStyle = "#ff8a4c"; x.font = "700 52px 'Barlow Condensed', sans-serif"; x.fillText("FIND MY LEVEL", W / 2, 520);
    x.fillStyle = "#fff"; x.font = "112px Anton, Impact, sans-serif"; x.fillText((U.POS[read.position] || read.position).toUpperCase(), W / 2, 660);
    x.fillStyle = "#c9d2e3"; x.font = "600 46px Inter, sans-serif"; x.fillText(`Class of ${i.gradYear}${read.kind === "pitching" && read.hand ? " · " + read.hand : ""}`, W / 2, 740);
    const v = (n, u) => n == null ? "—" : u === "s" ? n.toFixed(2) : String(n);
    const stats = read.kind === "pitching" ? [["MAX FB", v(m.maxFb), "mph"], ["GAME FB", v(m.typFb), "mph"], ["THROWS", i.throws || "—", ""]]
      : [["MAX EV", v(m.maxEv), "mph"], ["60-YARD", v(m.sixty, "s"), "sec"]].concat(read.family === "C" ? [["POP TIME", v(m.pop, "s"), "sec"]] : read.family === "OF" ? [["OF ARM", v(m.ofVelo), "mph"]] : [["IF ARM", v(m.ifVelo), "mph"]]);
    const bw = 300, gap = 30, x0 = (W - (bw * 3 + gap * 2)) / 2, y0 = 820;
    stats.forEach(([lab, val, unit], k) => {
      const bx = x0 + k * (bw + gap);
      x.fillStyle = "rgba(255,255,255,.06)"; x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = 2;
      x.beginPath(); x.roundRect ? x.roundRect(bx, y0, bw, 300, 28) : x.rect(bx, y0, bw, 300); x.fill(); x.stroke();
      x.fillStyle = "#ff8a4c"; x.font = "700 40px 'Barlow Condensed', sans-serif"; x.fillText(lab, bx + bw / 2, y0 + 70);
      x.fillStyle = "#fff"; x.font = "120px Anton, Impact, sans-serif"; x.fillText(val, bx + bw / 2, y0 + 210);
      x.fillStyle = "#c9d2e3"; x.font = "600 34px Inter, sans-serif"; x.fillText(unit, bx + bw / 2, y0 + 262);
    });
    const pf = primaryOf(read);
    x.fillStyle = "#c9d2e3"; x.font = "600 44px Inter, sans-serif";
    x.fillText(pf ? "BEST COLLEGE MATCH" : "WORKING TOWARD", W / 2, 1215);
    x.fillStyle = "#fff"; x.font = "120px Anton, Impact, sans-serif";
    const big = pf ? pf.label.toUpperCase() : "THE PUBLISHED TARGETS";
    const lines = wrap(x, big, 960).slice(0, 2);
    lines.forEach((ln, k) => x.fillText(ln, W / 2, 1335 + k * 122));
    if (pf) { x.fillStyle = "#ff8a4c"; x.font = "700 52px 'Barlow Condensed', sans-serif"; x.fillText(`${pf.score}/100 BENCHMARK FIT`, W / 2, 1335 + (lines.length - 1) * 122 + 80); }
    x.fillStyle = "#fff"; x.font = "600 38px Inter, sans-serif";
    x.fillText("Find your level free:", W / 2, 1625);
    x.fillStyle = "#ffb48a"; const site = shareSite() + "/find-my-level"; let fs = 40;
    do { x.font = `700 ${fs}px Inter, sans-serif`; fs -= 2; } while (x.measureText(site).width > 980 && fs > 22);
    x.fillText(site, W / 2, 1677);
    x.fillStyle = "#8f9bb3"; x.font = "500 30px Inter, sans-serif";
    x.fillText("A benchmark comparison, not a prediction.", W / 2, 1740);
    x.fillStyle = "#ff8a4c"; x.font = "700 64px 'Barlow Condensed', sans-serif"; x.fillText("@peachstaterecruits", W / 2, 1820);
    return new Promise(res => cv.toBlob(b => res(b), "image/png"));
  }
  async function share(idx) {
    const read = state.result.reads[idx], out = document.getElementById("shareOut" + idx); if (!out) return;
    out.hidden = false; out.innerHTML = `<p class="lvl-note-sm">Making your image…</p>`;
    const blob = await storyBlob(read);
    if (window.PSR && window.PSR.track) window.PSR.track("fml_share", read.position);
    const url = URL.createObjectURL(blob), name = `find-my-level-${read.position.toLowerCase()}.png`;
    const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    state.share = { blob, file, name };
    out.innerHTML = `<img src="${url}" alt="Your Find My Level story image" width="1080" height="1920">
      <div class="lvl-share-btns">${canShare ? `<button class="btn btn-peach" type="button" data-native="${idx}">Share…</button>` : ""}<a class="btn btn-line" href="${url}" download="${name}">Download image</a></div>
      <p class="lvl-share-tip"><b>Post it to your Instagram story and tag @${esc((window.PSR_CONFIG || {}).instagram || "peachstaterecruits")}</b> so we see it. Teammates can find their level at the link on the image.</p>
      <p class="lvl-note-sm">Made on your device. Nothing is uploaded.</p>`;
  }

  // ---------- v17 (v2): chips, same-age panel, clock, advanced, progress, review, print ----------
  const chipHtml = (key) => `<span class="lvl-chips-row">${V.chips(state.input, key).map(c => `<i class="lvl-chip${/Hand-timed/.test(c) ? " warn" : ""}">${esc(c)}</i>`).join("")}</span>${V.chipNote(state.input, key) ? `<small class="lvl-chip-note">${esc(V.chipNote(state.input, key))}</small>` : ""}`;
  const KEY_OF = { "Max fastball": "maxFb", "Typical game fastball": "typFb", "Max exit velocity": "maxEv", "60-yard dash": "sixty", "Catcher throw": "cVelo", "Best pop time": "pop", "Outfield throw": "ofVelo", "Infield throw": "ifVelo" };
  function numbersStrip(read) {
    const ys = yoursFor(read).filter(([, v]) => v != null);
    if (!ys.length) return "";
    return `<div class="lvl-nums"><h3>Your metrics</h3><ul>${ys.map(([l, v, u]) => `<li><span>${esc(l)}</span><b>${esc(fmtV(v, u))}</b>${chipHtml(KEY_OF[l])}</li>`).join("")}</ul></div>`;
  }
  function cohortTable(g) {
    const head = `<p class="lvl-note-sm"><b>${esc(g.title)}.</b> ${esc(g.region)}, classes ${esc(g.classes)}, ${typeof g.n === "object" ? Object.keys(g.n).map(k => `${esc(k)} n ${esc(g.n[k])}`).join(", ") : `n ${esc(g.n)}`}${g.earlyOnly ? ". Early commits only" : ""}.${g.source ? ` <a href="${esc(g.source.url)}" target="_blank" rel="noopener">PBR</a>` : ""}</p>
      ${g.smallSample ? `<p class="lvl-note-sm lvl-small">Small sample: fewer than 6 players in at least one group. Treat these as a rough picture.</p>` : ""}`;
    const rows = g.rows.filter(r => r.cols.some(c => c.mean != null)).map(r => `<div class="lvl-prow"><div class="lvl-prow-h"><b>${esc(r.label)}</b>${r.you != null ? `<span class="lvl-you">You: ${esc(r.unit === "s" ? r.you.toFixed(2) + " s" : r.you + " " + r.unit)}</span>` : ""}</div>
      <ul class="lvl-means">${r.cols.map(c => `<li><span>${esc(c.col)}</span><b>${c.mean == null ? "Not published" : esc(r.unit === "s" ? c.mean.toFixed(2) + " s" : c.mean + " " + r.unit)}</b><em class="na">${c.text ? esc(c.text) : r.you == null ? "Not entered" : ""}</em></li>`).join("")}</ul></div>`).join("");
    return head + rows;
  }
  function youngHtml(read, idx) {
    if (!state.add || !V) return "";
    const y = V.youngPanel(state.add, state.input, [read]);
    if (y.status === "none") return "";
    if (y.status !== "panel") return `<p class="lvl-note-sm lvl-young-line" data-young="${esc(y.status)}">${esc(y.line)}</p>`;
    const p = y.reads[0]; if (!p) return "";
    return `<section class="lvl-young" data-young="panel" aria-labelledby="yg${idx}"><h3 id="yg${idx}">When they were your age</h3>
      <p class="lvl-note-sm">${esc(y.intro)}</p>
      ${p.band ? `<p class="lvl-young-band">${esc(p.band)}</p>` : ""}${p.spinBand ? `<p class="lvl-young-band">${esc(p.spinBand)}</p>` : ""}
      ${p.needsPeak ? `<p class="lvl-note-sm">Add your max (peak) fastball to compare it with this group.</p>` : ""}
      ${(p.facts || []).map(f => `<p class="lvl-young-fact">${esc(f)}</p>`).join("")}
      ${p.noPositionGroup ? `<p class="lvl-note-sm">${esc(p.noPositionGroup)}</p>` : ""}
      ${p.groups.map(cohortTable).join("")}</section>`;
  }
  function frameHtml(read, idx) {
    if (!Z || !state.size) return "";
    const g = V ? V.gradeWhenMeasured(state.input).grade : null;
    const f = Z.frame(state.size, state.input, read, { grade: g, csvUrl: CFG.SIZE_CSV_URL });
    if (!f) return "";
    const notes = [...new Set(f.rows.map(r => r.oneTeamNote).concat(f.rows.map(r => r.pooledNote)).filter(Boolean))];
    const a = f.about;
    return `<section class="lvl-frame" data-frame="${esc(f.kind)}" aria-labelledby="fr${idx}"><h3 id="fr${idx}">${esc(f.title)} <small>Context only</small></h3>
      <p class="lvl-frame-head">${esc(f.headline)}</p>
      <div class="lvl-frame-scroll"><table class="lvl-frame-t"><caption class="sr-only">Your height and weight next to committed high school players and current college rosters, by level</caption>
        <thead><tr><th scope="col">Level</th><th scope="col">You</th><th scope="col">Committed high school players</th><th scope="col">College rosters now <small>(${esc(f.groupLabel.replace("College ", ""))})</small></th></tr></thead>
        <tbody>${f.rows.map(r => `<tr data-lv="${esc(r.level)}"><th scope="row">${esc(r.short)}</th><td>${esc(r.you)}</td><td${r.hs.length ? "" : ' class="na"'}>${esc(r.hsText)}</td><td>${esc(r.collegeText)}</td></tr>`).join("")}</tbody></table></div>
      ${notes.map(n => `<p class="lvl-note-sm">${esc(n)}</p>`).join("")}
      ${f.fgD1 ? `<p class="lvl-note-sm">${esc(f.fgD1Note)} ${f.fgD1.map(t => `${esc(t.tier)}: ${esc(Z.ht(t.height_in))}, ${esc(t.weight_lb)}`).join(" · ")}.</p>` : ""}
      <p class="lvl-frame-note">${esc(f.note)}</p>
      ${f.pitcherFact ? `<p class="lvl-young-fact">${esc(f.pitcherFact)}</p>` : ""}
      <details class="lvl-about"><summary>About this data</summary>
        <p class="lvl-note-sm">${esc(a.source)}.</p>
        <ul class="lvl-list lvl-about-l">${a.levels.map(l => `<li><b>${esc(l.level)}</b>: ${esc(l.teams)} teams, ${esc(l.n)} players${l.nWeight ? ` (${esc(l.nWeight)} with weights)` : ""}; average ${esc(l.height)}, ${esc(l.weight)} lb; ${esc(l.pct62)}% are 6'2" or taller, ${esc(l.pctUnder6)}% under 6'0".${l.note ? ` ${esc(l.note)}.` : ""}</li>`).join("")}</ul>
        <p class="lvl-note-sm"><b>Limits:</b> ${esc(a.limitations)}</p>
        <p class="lvl-note-sm">Committed high school players: Slammers (rising seniors, all positions; NAIA and JUCO pooled) and, for outfielders, Flatground (junior season and later). High school players weigh less than the 18–23-year-olds on college rosters.</p>
        <p class="lvl-note-sm"><a href="${esc(f.csvUrl)}" download>Download the 751 roster rows (CSV)</a>, each with its school roster link.</p>
      </details></section>`;
  }
  function clockHtml() {
    if (!state.add || !V) return "";
    const c = V.clock(state.add, state.input.gradYear, new Date()); if (!c) return "";
    if (c.graduated) return `<section class="lvl-clock" aria-labelledby="clockT"><h3 id="clockT">${esc(c.title)}</h3><p>${esc(c.line)}</p></section>`;
    const lv = (a) => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    return `<section class="lvl-clock" aria-labelledby="clockT"><h3 id="clockT">${esc(c.title)} <small>Class of ${esc(c.gradYear)}</small></h3>
      <p class="lvl-clock-now"><b>${c.openLevels.length ? `${esc(lv(c.openLevels))} recruiting communication is generally available for your class.` : "Coach communication depends on the rules below."}</b>${c.closedLevels.length ? ` ${esc(lv(c.closedLevels))}: not yet.` : ""}</p>
      ${c.next ? `<p class="lvl-clock-next"><span class="lvl-count">${esc(c.next.days)}<small>${c.next.days === 1 ? "day" : "days"}</small></span> <span>Next key date: <b>${esc(c.next.dateText)}</b>. ${esc(c.next.level)}: ${esc(c.next.event.toLowerCase())}.</span></p>` : ""}
      <ul class="lvl-clock-rules">${c.rules.map(r => `<li class="${r.open ? "ok" : ""}"><b>${esc(r.level)}</b> ${esc(r.event)}: ${esc(r.dateText)}</li>`).join("")}</ul>
      <p class="lvl-note-sm">You can prepare or send your introduction before a D1 response date. A lack of reply does not determine your ability. Dates below concern high-school prospects on a traditional U.S. school calendar; they do not resolve transfer or signed-aid restrictions.</p>
      <details class="lvl-about"><summary>One-state commitment context</summary><p class="lvl-note-sm">${esc(c.wave.text)}</p></details>
      <p class="lvl-note-sm">${esc(c.waveNote)} ${c.source ? `<a href="${esc(c.source.url)}" target="_blank" rel="noopener">Calendar source</a>` : ""}</p></section>`;
  }
  function advancedHtml() {
    if (!state.add || !V) return "";
    const a = V.advanced(state.add, state.data, state.input, state.result.reads); if (!a) return "";
    return `<div class="lvl-panel lvl-panel-flat" data-panel="advanced"><h4><span class="lvl-kind ctx">Context</span> ${esc(a.title)}</h4><p class="lvl-note-sm">${esc(a.note)}</p>
      ${a.rows.map(r => `<div class="lvl-prow"><div class="lvl-prow-h"><b>${esc(r.label)}</b><span class="lvl-you">You: ${esc(r.you + " " + r.unit)}</span>${chipHtml(r.key)}</div>
        ${r.cols.length ? `<ul class="lvl-means">${r.cols.map(c => `<li><span>${esc(c.col)}</span><b>${c.mean == null ? "Not published" : esc(c.mean + " " + r.unit)}</b><em class="na">${esc(c.text || "")}</em></li>`).join("")}</ul>` : ""}
        ${r.ranges ? `<ul class="lvl-means">${r.ranges.map(x => `<li><span>${esc(x.col)}</span><b>${esc(x.lo)}–${esc(x.hi)} mph</b><em class="na">${esc(x.where)}</em></li>`).join("")}</ul>` : ""}
        ${r.note ? `<p class="lvl-note-sm">${esc(r.note)}</p>` : ""}</div>`).join("")}</div>`;
  }
  function saveProgress() {
    if (!store || !PG) { state.progress = null; return; }
    try {
      const entry = PG.entryFrom(state.input, state.result.reads.map(r => U.headline(r).level || ""), new Date(), { model: FC ? FC.MODEL_VERSION : null, benchmarks: "nc-1.0+fills-1.2; psr-pitcher-1.0" });
      const hist = PG.save(store, entry);
      state.progress = { hist, entry: hist[hist.length - 1], d: PG.deltas(hist, hist[hist.length - 1]) };
    } catch (e) { state.progress = null; }
  }
  function progressHtml() {
    const p = state.progress; if (!p) return "";
    const cur = p.entry;
    const lines = PG.TRACKED.filter(([k]) => cur.metrics[k] != null).map(([k, label]) => {
      const d = p.d && p.d.items.find(x => x.key === k);
      const sp = PG.sparkline(PG.series(p.hist, cur.primary, k));
      return `<li class="${d ? (d.better === true ? "ok" : d.better === false ? "below" : "na") : "na"}"><span>${esc(label.replace(/^./, c => c.toUpperCase()))}</span>${sp}<b>${esc(d ? d.text : "First saved result")}</b></li>`;
    });
    return `<section class="lvl-prog no-print" aria-labelledby="progT"><h3 id="progT">Since last time${p.d ? ` <small>(${esc(p.d.since)})</small>` : ""}</h3>
      ${p.d ? "" : `<p class="lvl-note-sm">This is your first saved result here. Come back after your next showcase or training block to see what changed.</p>`}
      ${lines.length ? `<ul class="lvl-prog-d">${lines.join("")}</ul>` : ""}
      <p class="lvl-note-sm">Saved only in this browser (${esc(p.hist.length)} result${p.hist.length === 1 ? "" : "s"}). No account needed.</p>
      <button class="btn btn-line btn-sm" type="button" data-clear-history>Clear my saved results</button></section>`;
  }
  function reviewHtml() {
    const done = state.reviewSent;
    return `<section class="lvl-review no-print" aria-labelledby="revT"><h3 id="revT">Want a free look from Peach State?</h3>
      ${done ? `<p class="lvl-review-ok" role="status">Sent. We'll take a look and reply on Instagram to @${esc(done)}.</p>` : `
      <p>We'll look at your metrics and reply on Instagram. Free, no obligation.</p>
      <button class="btn btn-peach" type="button" data-review-open>Send my metrics to Peach State for a free look</button>
      <div id="lvlReviewForm" class="lvl-review-form" hidden>
        <label for="f_igHandle">Your Instagram handle</label>
        <div class="lvl-review-row"><input class="input" id="f_igHandle" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="@yourhandle" maxlength="31"><button class="btn btn-peach" type="button" data-review-send>Send</button></div>
        <p class="lvl-note-sm">We'll send your handle, class, position, metrics, how they were measured and your headline result. Nothing else. If you're under 18, check with a parent first. <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a></p>
        <p class="lvl-err" id="reviewErr" hidden></p>
      </div>`}
      <p class="lvl-privacy">Sending shares these metrics with us so we can reply. Otherwise they stay on this device and in your private account.</p></section>`;
  }
  async function sendReview() {
    const h = document.getElementById("f_igHandle"), er = document.getElementById("reviewErr"), btn = app.querySelector("[data-review-send]");
    const show = (m) => { er.textContent = m; er.hidden = !m; };
    const payload = V.reviewPayload(h ? h.value : "", state.input, state.result);
    if (!payload.ig_handle) { show("Enter your Instagram handle, like @yourname (letters, numbers, dots and underscores)."); if (h) h.focus(); return; }
    const C = window.PSR_CONFIG || {};
    const reviewKey=C.supabasePublishableKey||C.supabaseAnonKey;
    if (!C.supabaseUrl || !reviewKey) { show("Sending isn't available right now. DM us on Instagram instead."); return; }
    show(""); if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    try {
      const r = await fetch(`${C.supabaseUrl}/rest/v1/level_reviews`, { method: "POST", headers: { apikey: reviewKey, Authorization: `Bearer ${reviewKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(r.status);
      state.reviewSent = payload.ig_handle; const y = window.scrollY; render(NOV); window.scrollTo(0, y);
      if (window.PSR && window.PSR.toast) window.PSR.toast("Sent to Peach State");
    } catch (e) { show("That didn't send. Check your connection and try again, or DM us on Instagram."); if (btn) { btn.disabled = false; btn.textContent = "Send"; } }
  }
  function printHtml() {
    const r = state.result, i = state.input;
    const reads = r.reads.map(rd => { const h = U.headline(rd), n = U.nextStep(rd);
      return `<div class="pr-read"><h3>${esc(U.title(rd))}</h3><p class="pr-head">${esc(h.text)}</p><p>${esc(h.support)}</p>${n ? `<p><b>Next benchmark:</b> ${esc(n.text.replace(/^Next benchmark: /, ""))}</p>` : ""}
        <table class="pr-levels"><tr>${U.levels(rd).map(l => `<th>${esc(l.label)}</th>`).join("")}</tr><tr>${U.levels(rd).map(l => `<td>${esc(l.status)}</td>`).join("")}</tr></table>
        <ul class="pr-nums">${yoursFor(rd).filter(([, v]) => v != null).map(([l, v, u]) => `<li><b>${esc(l)}:</b> ${esc(fmtV(v, u))} <small>(${esc(V.chips(i, KEY_OF[l]).join(", "))})</small></li>`).join("")}</ul></div>`; }).join("");
    const c = state.add ? V.clock(state.add, i.gradYear, new Date()) : null;
    return `<div class="lvl-print" aria-hidden="true">
      <div class="pr-top"><img src="images/logo-160.png" alt="" width="56" height="56"><div><b>Find My Level</b><span>Peach State Recruits · ${esc(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span></div></div>
      <p class="pr-meta">${esc(positions().join(" / "))} · Class of ${esc(i.gradYear)} · Throws ${esc(i.throws)} · Bats ${esc(i.bats)}</p>
      ${reads}
      ${c && !c.graduated ? `<p><b>Recruiting clock:</b> ${esc(c.openLevels.join(", "))} communication may be available; verify the rules with the school.${c.next ? ` Next key date: ${esc(c.next.dateText)} (${esc(c.next.level)}).` : ""}</p>` : ""}
      <p class="pr-cav">${esc(U.CAVEAT)} Benchmark data v${esc(r.dataVersion)}. Sources: NextCommit, NCSA, BaseballPath, Flatground, Slammers, Pitching Coach U, PBR. Metrics are self-reported.</p>
      <p class="pr-foot">peachstaterecruits on Instagram · dawsonjones1010-ux.github.io/peach-state-recruits/find-my-level.html</p></div>`;
  }

  // ---------- Input collection ----------
  function collect() {
    const i = state.input;
    app.querySelectorAll("[data-plain]").forEach(el => { state.raw[el.dataset.plain] = el.value; });
    app.querySelectorAll("[data-sel]").forEach(el => {
      const k = el.dataset.sel, v = el.value;
      if (k === "gradYear") i.gradYear = v ? parseInt(v, 10) : null;
      else if (k === "environment" || k === "method" || k === "grade") i.meta[k] = v;
      else if (k === "pitchDevice") i.methods.pitchDevice = v;
      else if (k === "bbType" || k === "competition" || k === "pCompetition") i.metrics[k] = v;
      else if (k.startsWith("m_")) i.methods[k.slice(2)] = v;
      else i[k] = v;
    });
    ["throws", "bats"].forEach(n => { const el = app.querySelector(`input[name="${n}"]:checked`); if (el) i[n] = el.value; else if (app.querySelector(`input[name="${n}"]`)) i[n] = ""; });
    const src = app.querySelector('input[name="source"]:checked'); if (src) i.meta.source = src.value;
    const hf = app.querySelector('[data-h="ft"]'), hi = app.querySelector('[data-h="in"]');
    if (hf) { state.raw.hFt = hf.value; state.raw.hIn = hi.value; i.heightIn = hf.value ? parseInt(hf.value, 10) * 12 + (hi.value ? parseInt(hi.value, 10) : 0) : null; }
    app.querySelectorAll("[data-num]").forEach(el => { state.raw[el.dataset.num] = el.value; });
    app.querySelectorAll("[data-rep]").forEach(el => {
      const rep = new Set(i.metrics.repertoire || []); el.checked ? rep.add(el.dataset.rep) : rep.delete(el.dataset.rep); i.metrics.repertoire = PITCHES.filter(p => rep.has(p));
    });
    const d = app.querySelector('[data-meta="date"]'); if (d) i.meta.date = state.unknown.has("date") ? "" : d.value;
    const lk = app.querySelector('[data-meta="link"]'); if (lk) i.meta.link = lk.value.trim();
  }

  // Parse raw text into numbers; returns parse errors.
  function parseAll() {
    const errors = [], i = state.input;
    const plain = (k, kind) => {
      const raw = state.raw[k]; if (raw == null) return;
      const p = L.parseEntry(raw, kind);
      if (p.error) { errors.push({ field: k, msg: p.error }); i[k] = null; } else i[k] = p.value;
    };
    plain("weightLb", "number");
    const active = step2Fields();
    Object.keys(F).forEach(k => {
      if (!active.includes(k) || state.unknown.has(k)) { i.metrics[k] = null; return; }
      const p = L.parseEntry(state.raw[k], F[k].kind);
      if (p.error) { errors.push({ field: k, msg: `${F[k].label}: ${p.error}` }); i.metrics[k] = null; } else i.metrics[k] = p.value;
    });
    if (!hasP()) { i.metrics.repertoire = []; i.metrics.bbType = ""; i.metrics.pCompetition = ""; }
    if (!hasField()) i.metrics.competition = "";
    return errors;
  }

  function check(step) {
    const parseErr = parseAll();
    const v = L.validate(state.input, state.confirmed);
    v.errors = parseErr.concat(v.errors.filter(e => !parseErr.some(p => p.field === e.field)));
    const fields = step === 1 ? STEP1 : step === 2 ? step2Fields() : STEP3;
    return { errors: v.errors.filter(e => fields.includes(e.field)), warnings: v.warnings.filter(w => fields.includes(w.field)) };
  }

  // ---------- Render ----------
  function render(v, focus) {
    v = v || NOV;
    document.querySelectorAll("#lvlSteps li").forEach(li => {
      const n = +li.dataset.step; li.classList.toggle("is-on", n === state.step); li.classList.toggle("is-done", n < state.step);
      if (n === state.step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    const openSecs = state.step === 4 ? [...app.querySelectorAll("details[open][data-sec]")].map(d => d.closest("[data-read]") ? d.closest("[data-read]").dataset.read + ":" + d.dataset.sec : d.dataset.sec) : [];
    const openMore = state.step === 4 ? [...app.querySelectorAll(".lvl-more[open]")].map(d => d.dataset.more) : [];
    app.innerHTML = state.step === 1 ? welcomeHtml() + step1(v) : state.step === 2 ? step2(v) : state.step === 3 ? step3(v) : results();
    if (state.step === 4) {
      app.querySelectorAll(".lvl-read[data-read]").forEach(arrangeRead);
      app.querySelectorAll(".lvl-read[data-read] > .lvl-board").forEach(b => { if (!b.nextElementSibling || !b.nextElementSibling.classList.contains("lvl-acct-line")) b.insertAdjacentHTML("afterend", `<p class="lvl-acct-line no-print" role="status"></p>`); });
      if (!acctStatus && window.PSRLevelSync) window.PSRLevelSync.signedIn().then(on => { if (!acctStatus) { acctStatus = on && state.saved && state.saved.synced ? "saved" : "signedout"; paintAcct(); } });
      paintAcct();
      openMore.forEach(k => { const d = app.querySelector(`.lvl-more[data-more="${k}"]`); if (d) d.open = true; });
      fillLikeYou(); fillPicks();
    }
    openSecs.forEach(k => { const [r, sct] = k.includes(":") ? k.split(":") : [null, k]; const d = app.querySelector(r != null ? `[data-read="${r}"] [data-sec="${sct}"]` : `.lvl-results [data-more="g"] [data-sec="${sct}"]`); if (d) d.open = true; });
    const sum = document.getElementById("lvlSummary");
    if (sum) sum.focus();
    else if (focus) { const h = app.querySelector(state.step === 4 ? ".lvl-tabpanel:not([hidden]) h2" : "h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } const top = state.step === 4 ? app.querySelector(".lvl-results") : document.querySelector(".lvl-main"); const nav = document.querySelector(".nav"); if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - (nav ? nav.offsetHeight : 64) - 8, behavior: "instant" }); }
  }

  function go(step) { collect(); state.step = step; render(NOV, true); }

  app.addEventListener("submit", (e) => {
    e.preventDefault();
    collect();
    const v = check(state.step);
    if (v.errors.length || v.warnings.length) { render(v); return; }
    if (state.step === 3) {
      state.result = L.evaluate(state.data, state.input); state.step = 4; state.tab = 0; saveProgress();
      try { const r0 = state.result.reads[0]; if (window.PSR && window.PSR.track) window.PSR.track("fml_result", r0 ? ((primaryOf(r0) || {}).key || "below") : "none"); } catch (_) {}
      saveSummary();
    }
    else state.step += 1;
    render(NOV, true);
  });
  app.addEventListener("click", (e) => {
    const eh = e.target.closest("[data-email-handoff]");
    if(eh){if(window.PSR&&window.PSR.track)window.PSR.track("email_handoff",eh.dataset.school?"school":"general");try{sessionStorage.setItem("psr_email_handoff_v2",JSON.stringify(R.handoff(state.input,state.result.reads[+eh.dataset.emailHandoff])));location.href="email-coach.html?from=level"+(eh.dataset.school?"&school="+encodeURIComponent(eh.dataset.school):"");}catch(error){if(window.PSR)window.PSR.toast("This browser cannot transfer your metrics. Open Email Coach and enter them there.");}return;}
    const cp=e.target.closest("[data-copy-snapshot]");if(cp){const text=R.snapshot(state.input,state.result.reads[+cp.dataset.copySnapshot]);Promise.resolve().then(()=>navigator.clipboard.writeText(text)).then(()=>window.PSR&&window.PSR.toast("Coach snapshot copied")).catch(()=>{const out=document.getElementById("snapshotText"+cp.dataset.copySnapshot);out.hidden=false;out.value=text;out.focus();out.select();});return;}
    const sc=e.target.closest("[data-run-scenario]");if(sc){runScenario(+sc.dataset.runScenario);return;}
    const pw=e.target.closest("[data-run-pwhat]");if(pw){runPitcherWhatIf(+pw.dataset.runPwhat);return;}
    const qw=e.target.closest("[data-run-qwhat]");if(qw){runPositionWhatIf(+qw.dataset.runQwhat);return;}
    const edit=e.target.closest('[data-edit-evidence]');if(edit){go(3);return;}
    const tb = e.target.closest("[data-tab]"); if (tb) { selectTab(+tb.dataset.tab, true); return; }
    const sh = e.target.closest("[data-share]"); if (sh) { share(+sh.dataset.share); return; }
    const nv = e.target.closest("[data-native]"); if (nv && state.share) { navigator.share({ files: [state.share.file], title: "Find My Level", text: "My college baseball benchmark comparison. @peachstaterecruits" }).catch(() => {}); return; }
    if (e.target.closest("[data-reopen]")) { reopenSaved(); return; }
    if (e.target.closest("[data-fresh]")) { state.welcomeClosed = true; render(); const f = document.getElementById("f_gradYear"); if (f) f.focus(); return; }
    const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(+g.dataset.go); return; }
    if (e.target.closest("[data-print]")) { window.print(); return; }
    if (e.target.closest("[data-clear-history]")) { if (store && PG) PG.clear(store); state.progress = null; const y = window.scrollY; render(NOV); window.scrollTo(0, y); if (window.PSR && window.PSR.toast) window.PSR.toast("Saved results cleared on this device"); return; }
    if (e.target.closest("[data-review-open]")) { const f = document.getElementById("lvlReviewForm"); if (f) { f.hidden = false; const h = document.getElementById("f_igHandle"); if (h) h.focus(); } return; }
    if (e.target.closest("[data-review-send]")) { sendReview(); return; }
    if (e.target.closest("[data-reset]")) { location.href = location.pathname; return; }
    const f = e.target.closest("[data-focus]"); if (f) { e.preventDefault(); const el = document.getElementById("f_" + f.dataset.focus) || app.querySelector(`[name="${f.dataset.focus}"]`); if (el) el.focus(); }
  });
  function selectTab(k, focus) {
    state.tab = k;
    app.querySelectorAll("[data-tab]").forEach(b => { const on = +b.dataset.tab === k; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    app.querySelectorAll(".lvl-tabpanel").forEach((p, j) => { p.hidden = j !== k; });
  }
  app.addEventListener("keydown", (e) => {
    const tb = e.target.closest("[data-tab]"); if (!tb || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
    const n = app.querySelectorAll("[data-tab]").length, c = +tb.dataset.tab; e.preventDefault();
    selectTab(e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (c + (e.key === "ArrowRight" ? 1 : n - 1)) % n, true);
  });
  app.addEventListener("input", e => { if (e.target.dataset.num) state.confirmed.delete(e.target.dataset.num); if (e.target.dataset.plain) state.confirmed.delete(e.target.dataset.plain); });
  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-picks-state]")) { try { localStorage.setItem(window.PSRPicks.STATE_KEY, t.value); } catch (_) {} const which = t.closest("[data-picks]").dataset.picks; app.querySelectorAll("[data-picks]").forEach(drawPicks); const s = app.querySelector(`[data-picks="${which}"] [data-picks-state]`); if (s) s.focus(); return; }
    if(t.dataset.h)state.confirmed.delete("heightIn");
    if (t.dataset.unknown) {
      const k = t.dataset.unknown; collect();
      if (t.checked) { state.unknown.add(k); if (k !== "date") state.raw[k] = ""; } else state.unknown.delete(k);
      const inp = document.getElementById("f_" + k); if (inp) { inp.disabled = t.checked; if (t.checked) inp.value = ""; else inp.focus(); }
      return;
    }
    if (t.dataset.confirm) { t.checked ? state.confirmed.add(t.dataset.confirm) : state.confirmed.delete(t.dataset.confirm); return; }
    if(t.dataset.target!=null){const idx=+t.dataset.target;state.gapCat[idx]=t.value;const box=document.getElementById("workbenchRows"+idx);box.innerHTML=workbenchRows(state.result.reads[idx],t.value);return;}
    if (t.dataset.gap != null) { state.gapCat[t.dataset.gap] = t.value; const y = window.scrollY; render(NOV); window.scrollTo(0, y); const s = document.getElementById("gap" + t.dataset.gap); if (s) s.focus({ preventScroll: true }); }
  });

  // ---------- Boot ----------
  const getJson = (u) => fetch(u, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  Promise.all([getJson(CFG.DATA_URL + "?v=1.0"), getJson(CFG.ADDITIONS_URL + "?v=1.1").catch(() => null), getJson(CFG.SIZE_URL + "?v=1").catch(() => null), getJson(CFG.FILLS_URL + "?v=1.2").catch(() => null)]).then(([d, a, z, f]) => {
    state.data = L.withFills(d, f); state.add = a; state.size = z;
    try { const s = JSON.parse(localStorage.getItem(SUMMARY_KEY) || "null"); if (s && s.v === 1) state.saved = s; } catch (_) {}
    render();
    if (window.PSRLevelSync) window.PSRLevelSync.sync().then(s => { if (s && s.input && (!state.saved || s.t !== state.saved.t)) { state.saved = s; if (state.step === 1 && !state.result) render(); } }).catch(() => {});
  }).catch(() => { app.innerHTML = `<p class="lvl-card">The benchmark data couldn't load. Please refresh the page.</p>`; });

  window.PSRLevelUI = { state }; // for tests only; holds nothing outside this page
})();
