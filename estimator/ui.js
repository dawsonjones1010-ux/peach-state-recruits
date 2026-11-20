/*
  College Baseball Level Estimator: interface. Uses PSRLevel (logic) and PSRLevelConfig (config).
  Nothing leaves the browser unless the player taps Send (the opt-in free review). No analytics.
  The only network calls are the two static benchmark files and, after Send, one insert into
  level_reviews. Completed results are saved in this browser's localStorage (progress), and the
  player can clear them.
*/
(function () {
  "use strict";
  const L = window.PSRLevel, CFG = window.PSRLevelConfig, S = L.S, V = window.PSRLevelV2, PG = window.PSRLevelProgress, Z = window.PSRLevelSize;
  const store = (() => { try { const k = "__psr_t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  const app = document.getElementById("lvlApp");
  if (!app || !L) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Field definitions ----------
  const F = {
    maxFb:     { label: "Max fastball", unit: "mph", kind: "number", hint: "Your highest valid fastball reading." },
    typFb:     { label: "Typical game fastball", unit: "mph", kind: "number", hint: "What you usually throw in games, if you know it. Can't be higher than your max." },
    strikePct: { label: "Strike rate", unit: "%", kind: "percent", hint: "Strikes ÷ all pitches, from your season stats." },
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
    batSpeed:  { label: "Bat speed", unit: "mph", kind: "number", hint: "From Blast or a similar sensor. Context only." }
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
    const w = v.warnings.filter(x => x.field === field).map(x => `<div class="lvl-warn" id="err-${field}"><p>${esc(x.msg)}</p><label class="lvl-check"><input type="checkbox" data-confirm="${field}"> This number is correct</label></div>`);
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
      <p class="lvl-sub">Position decides which numbers we ask for next. A second position gets its own separate read.</p>
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
      <div class="lvl-actions"><span class="lvl-privacy">Nothing leaves your browser unless you tap Send.</span><button class="btn btn-peach btn-lg" type="submit">Next: your numbers</button></div>
    </form>`;
  }

  function step2Fields() {
    const f = [];
    if (hasP()) f.push("maxFb", "typFb", "strikePct", "era", "whip", "fbSpin", "bbSpin", "extension", "ivb");
    if (hasField()) {
      f.push("maxEv", "sixty", "avgEv", "batSpeed", "thirty", "avg", "obp", "slg");
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
        <div class="lvl-grid">${numField("maxFb", v)}${numField("typFb", v, { optional: true })}</div>
        <fieldset class="lvl-field"><legend>Pitches you throw in games <span class="lvl-opt">optional</span></legend><div class="lvl-chips">${PITCHES.map(p => `<label><input type="checkbox" data-rep="${esc(p)}" ${rep.includes(p) ? "checked" : ""}><span>${esc(p)}</span></label>`).join("")}</div>
        <p class="lvl-hint">Recorded for your read. There are no published numeric targets for repertoire, command or pitch quality.</p></fieldset>
        <details class="lvl-more"><summary>Add more information <span class="lvl-opt">control and results, optional</span></summary><div class="lvl-grid">${numField("strikePct", v, { optional: true })}${numField("era", v, { optional: true })}${numField("whip", v, { optional: true })}${numField("fbSpin", v, { optional: true })}${numField("bbSpin", v, { optional: true })}${numField("extension", v, { optional: true })}${numField("ivb", v, { optional: true })}</div>
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
        <details class="lvl-more"><summary>Add more information <span class="lvl-opt">optional</span></summary><div class="lvl-grid">${numField("avgEv", v, { optional: true })}${numField("batSpeed", v, { optional: true })}${numField("thirty", v, { optional: true })}${numField("avg", v, { optional: true })}${numField("obp", v, { optional: true })}${numField("slg", v, { optional: true })}</div></details>
      </fieldset>`);
    }
    return `<form class="lvl-card lvl-form" data-step="2" novalidate>
      <h2>Your current numbers</h2>
      <p class="lvl-sub">Enter what you know. Leave a box blank or tick "I don't know" if you don't have it. Blank is treated as unknown, never as zero.</p>
      ${summary(v, fs)}
      ${parts.join("")}
      <details class="lvl-more lvl-methods"${Object.values(state.input.methods).some(Boolean) ? " open" : ""}><summary>How were these measured? <span class="lvl-opt">optional</span></summary>
        <p class="lvl-hint">Shown as a chip next to each number. We never convert one method into another.</p>
        <div class="lvl-grid">
          ${hasField() ? select("m_sixty", "60-yard timed by", SIXTY_M, state.input.methods.sixty, v, { optional: true }) : ""}
          ${hasField() ? select("m_ev", "Exit velocity hit off", EV_M, state.input.methods.ev, v, { optional: true }) : ""}
          ${hasField() ? select("m_evDevice", "Exit velocity device", EV_DEV, state.input.methods.evDevice, v, { optional: true }) : ""}
          ${select("m_veloDevice", hasP() && hasField() ? "Velocity device (fastball and throws)" : hasP() ? "Fastball velocity device" : "Throwing velocity device", VELO_DEV, state.input.methods.veloDevice, v, { optional: true })}
        </div></details>
      <div class="lvl-actions"><button class="btn btn-line btn-lg" type="button" data-go="1">Back</button><button class="btn btn-peach btn-lg" type="submit">Next: about the numbers</button></div>
    </form>`;
  }

  const STEP3 = ["date", "environment", "method", "source", "link"];
  function step3(v) {
    const m = state.input.meta, unkDate = state.unknown.has("date");
    return `<form class="lvl-card lvl-form" data-step="3" novalidate>
      <h2>About these numbers</h2>
      <p class="lvl-sub">This tells us how comparable your numbers are. "I don't know" is fine; we'll explain what it means for the result.</p>
      ${summary(v, STEP3)}
      <div class="lvl-grid">
        <div class="lvl-field${v.errors.some(x => x.field === "date") ? " is-invalid" : ""}" data-wrap="date"><label for="f_date">When were they measured?</label>
          <input class="input" type="date" id="f_date" data-meta="date" value="${esc(m.date)}" max="${new Date().toISOString().slice(0, 10)}" ${unkDate ? "disabled" : ""}>
          <label class="lvl-check"><input type="checkbox" data-unknown="date" ${unkDate ? "checked" : ""}> I don't know</label>${errorsFor("date", v)}</div>
        ${select("environment", "Testing environment", ENV, m.environment, v)}
        ${select("method", "Measured with", METHOD, m.method, v)}
        ${select("grade", "What grade were you in when you got these numbers?", GRADES, m.grade, v, { optional: true, hint: "Used only for the same-age comparison. It never changes your level." })}
      </div>
      ${seg("source", "Where do the numbers come from?", SOURCE, m.source, v, true)}
      <div class="lvl-field${v.errors.some(x => x.field === "link") ? " is-invalid" : ""}" data-wrap="link"><label for="f_link">Result link <span class="lvl-opt">optional</span></label>
        <input class="input" type="url" id="f_link" data-meta="link" inputmode="url" placeholder="https://" value="${esc(m.link)}" autocomplete="off">
        <p class="lvl-hint">Saved as a reference on your result only. A link alone doesn't verify the numbers, and we don't open or analyze it.</p>${errorsFor("link", v)}</div>
      <div class="lvl-actions"><button class="btn btn-line btn-lg" type="button" data-go="2">Back</button><button class="btn btn-peach btn-lg" type="submit">See my results</button></div>
    </form>`;
  }

  // ---------- Results ----------
  const pillClass = (st) => st === S.MEETS ? "ok" : st === S.BELOW ? "below" : st === S.NO_INPUT ? "none" : "na";
  const fmtV = (v, unit) => L.fmt(v, unit === "seconds" ? "seconds" : unit === "mph" ? "mph" : unit);

  const R = window.PSRLevelReport, Research = window.PSRResearch;
  const U = window.PSRLevelSummary, ds = (s) => esc(U.deSource(s));
  const statusText = (st) => st === S.NO_BENCH ? "No published target" : st;
  const ST_CLASS = { "Meets targets": "ok", "Close": "close", "Below targets": "below", "Needs more numbers": "none", "No published target": "na" };

  function toolRow(k, t) {
    const val = t.value != null ? `<span class="lvl-you">You: ${esc(fmtV(t.value, t.unit))}</span>` : "";
    const tgt = t.band && t.status !== S.NO_BENCH ? `<span class="lvl-tgt">Target: ${esc(t.band)}${t.qualifier && /open|least|single|says/i.test(t.qualifier) ? ` <small>(${esc(t.qualifier)})</small>` : ""}</span>` : "";
    const extra = t.status === S.BELOW ? `<span class="lvl-gap">${t.unit === "seconds" ? esc(t.gap.toFixed(2)) + " s slower than" : esc(t.gap) + " mph short of"} the listed ${t.unit === "seconds" ? esc(t.threshold.toFixed(2)) + " s" : esc(t.threshold) + " mph"} mark</span>` : "";
    return `<li class="lvl-tool">
      <div class="lvl-tool-top"><b>${esc(TOOL_LABEL[k])}</b><span class="lvl-pill ${pillClass(t.status)}">${esc(statusText(t.status))}</span></div>
      <div class="lvl-tool-meta">${val}${tgt}${extra}</div>
      ${t.note ? `<p class="lvl-note-sm">${ds(t.note)}</p>` : ""}
      ${(t.status === S.NO_BENCH || t.status === S.REF_ONLY || t.status === S.NOT_COMP) && t.reason ? `<p class="lvl-note-sm">${ds(t.reason)}${t.status === S.REF_ONLY && t.band ? ` Source value: ${esc(t.band)}.` : ""}</p>` : ""}
      ${t.pooledGroup ? `<p class="lvl-note-sm">The source combines NAIA and JUCO for this target.</p>` : ""}
    </li>`;
  }

  function catCard(read, c) {
    const comp = c.compared.map(k => TOOL_LABEL[k]);
    const notIn = c.missing.filter(x => x.status === S.NO_INPUT).map(x => TOOL_LABEL[x.tool]);
    const noTgt = c.missing.filter(x => x.status !== S.NO_INPUT).map(x => TOOL_LABEL[x.tool]);
    const st = U.levelStatus(read, c);
    const noData = read.kind === "position" && c.key === "low";
    const ns = c.nsRef ? `<div class="lvl-ns"><span class="lvl-kind ref">Second source</span> <b>${esc(c.nsRef.label)}</b> <small>(its group: ${esc(c.nsRef.sourceLevel)})</small>
      <div class="lvl-tool-meta"><span class="lvl-pill ${pillClass(c.nsRef.cmp.status)}">${esc(statusText(c.nsRef.cmp.status))}</span>${c.nsRef.cmp.band && c.nsRef.cmp.status !== S.NO_BENCH ? `<span class="lvl-tgt">Target: ${esc(c.nsRef.cmp.band)}</span>` : ""}</div>
      ${c.nsRef.cmp.status === S.NO_BENCH ? `<p class="lvl-note-sm">${ds(c.nsRef.cmp.reason)}</p>` : ""}${c.nsRef.pooledNote ? `<p class="lvl-note-sm">${ds(c.nsRef.pooledNote)}</p>` : ""}
      <p class="lvl-note-sm">A separate published target. Shown for reference; not used for the level status.</p></div>` : "";
    return `<details class="lvl-cat${c.highlighted ? " is-hl" : ""}" data-cat="${c.key}">
      <summary><span class="lvl-cat-h"><h4>${esc(c.label)}</h4><span class="lvl-st ${ST_CLASS[st]}">${esc(st)}</span></span>
        <span class="lvl-mini">${read.toolKeys.map(k => `<span><b>${esc(TOOL_LABEL[k])}</b> <i class="lvl-pill ${pillClass(c.tools[k].status)}">${esc(statusText(c.tools[k].status))}</i></span>`).join("")}</span>
        <span class="lvl-more-k" aria-hidden="true">Details</span></summary>
      <p class="lvl-src"><span class="lvl-kind guide">Published target</span> Category: ${esc(c.ncLabel)}</p>
      ${noData ? `<p class="lvl-note-sm"><b>This source has no separate lower D1 targets for position players.</b> This is a data gap, not a negative result. Nothing is borrowed from mid-major or other D1 numbers.</p>` : ""}
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
    if (notIn.length) return `Next step: add your ${notIn.map(k => ({ hitting: "max exit velocity", running: "60-yard dash", throwing: "throwing numbers", pitching: "fastball velocity" })[k]).join(" and ")} to compare more levels.`;
    return "Next step: get your full set of numbers and film in front of coaches. A published-target comparison can only go so far for this position.";
  }

  function sec(id, title, body) {
    return `<details class="lvl-sec" data-sec="${id}"><summary><span>${esc(title)}</span><i aria-hidden="true"></i></summary><div class="lvl-sec-b">${body}</div></details>`;
  }

  // Link the comparison to the College Finder by level only (no program-specific fit scores).
  function exploreHtml(read) {
    const KEY = { p4: "NCAA D1", mid: "NCAA D1", low: "NCAA D1", d2: "NCAA D2", d3: "NCAA D3", naia: "NAIA", juco: "JUCO" };
    const lv = U.levels(read).filter(l => l.status === U.ST.MEETS || l.status === U.ST.CLOSE).map(l => KEY[l.key]);
    const uniq = [...new Set(lv)];
    const href = "colleges.html?" + (uniq.length ? "levels=" + encodeURIComponent(uniq.join(",")) + "&" : "") + "from=fml";
    return `<div class="lvl-explore no-print"><p class="lvl-cta2-t">Explore college programs${uniq.length ? ` at ${esc(uniq.join(", "))}` : ""}</p>
      <p class="lvl-note-sm">Opens the College Finder filtered by level. It doesn't rate how you fit any specific school.</p>
      <a class="btn btn-line" href="${href}">Open College Finder</a></div>`;
  }

  function reportOverview(read,idx){
    const evidence=R.evidence(state.input,read), met=read.categories.filter(c=>c.highlighted), max=Math.max(0,...read.categories.map(c=>c.compared.length));
    return `<div class="pro-overview"><div><span>TOOLS COMPARED</span><strong>${max}<small> / ${read.toolKeys.length}</small></strong><p>${read.kind==='pitching'?'Fastball only; not a complete pitching evaluation.':'Distinct tools with targets in one category. Missing tools stay unknown.'}</p></div><div><span>CATEGORIES TO EXPLORE</span><strong>${met.length}</strong><p>${met.length?'Publisher targets met; several levels can overlap.':'More data or development may help. There is no ceiling assigned.'}</p></div><div><span>MEASUREMENT CONTEXT</span><strong class="pro-small-value">${esc(evidence.label)}</strong><p>${esc(evidence.sourceLabel)}.</p><button class="pro-text-button" type="button" data-edit-evidence>Review test details</button></div></div>
    ${evidence.issues.length?`<details class="pro-context"><summary>Make this comparison more useful <span>${evidence.issues.length} context notes</span></summary><ul>${evidence.issues.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>These notes affect how you interpret the result. They never add or subtract athletic points.</p></details>`:''}`;
  }
  function crossCheckHtml(read){const rows=R.crossCheck(state.data,state.input,read);return `<section class="pro-crosscheck"><div class="pro-section-head"><div><p class="pro-eyebrow">A SEPARATE REFERENCE</p><h3>NCSA guideline cross-check</h3></div><a href="https://www.ncsasports.org/baseball/recruiting-guidelines" target="_blank" rel="noopener">Read the source</a></div><p class="lvl-note-sm">NCSA groups all D1 together and combines D3 with NAIA. It cannot separate Power, mid-major and lower D1. Guidelines describe tools; they do not assign a player to a school.</p><div class="pro-cross-grid">${rows.map(r=>`<article><h4>${esc(r.level)}</h4>${r.tools.length?r.tools.map(t=>`<div><b>${esc(t.label)}</b><span>${esc(t.target)}</span><strong class="${t.met===null?'neutral':t.met?'positive':'attention'}">${t.value==null?'Add this measurement':esc(t.value+(t.unit==='s'?' s':' mph'))+' · '+(t.met?'Numerically meets':'Below guideline')}</strong><small>${esc(t.note)}</small></div>`).join(''):'<p>No usable numeric guideline for this position in our checked records. Review the source with your coach.</p>'}</article>`).join('')}</div></section>`;}
  function workbenchRows(read,key){const r=R.rows(read,key);return r.tools.map(t=>`<article class="pro-tool"><div><span>${esc(t.label)}</span><strong>${t.value==null?'Not entered':esc(fmtV(t.value,t.unit))}</strong></div><div><span>Published target</span><b>${t.target?esc(t.target):'Not published for this tool/category'}</b><small>${esc(statusText(t.status))}</small></div><div><span>What this tells you</span><p>${t.gap!=null?esc((t.unit==='seconds'?t.gap.toFixed(2)+' s':t.gap+' mph')+' from the listed edge.'):t.status===S.MEETS?'This number reaches the listed edge. Keep game performance and consistency in the evaluation.':esc(t.note||'Add the relevant measurement or discuss the missing benchmark with your coach.')}${t.narrow?' <b>Small numerical gap: retest under the same protocol before treating this as a meaningful difference.</b>':''}</p></div></article>`).join('');}
  function workbenchHtml(read,idx){const chosen=state.gapCat[idx]||(read.categories.find(c=>c.highlighted)||read.categories[0]).key;return `<section class="pro-workbench" id="target-workbench${idx}"><div class="pro-section-head"><div><p class="pro-eyebrow">KNOW WHAT TO WORK ON</p><h3>Your target comparison</h3></div><label>Compare against<select class="select" data-target="${idx}" aria-label="Target category for ${esc(read.position)}">${read.categories.map(c=>`<option value="${c.key}" ${c.key===chosen?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label></div><div id="workbenchRows${idx}">${workbenchRows(read,chosen)}</div><p class="lvl-note-sm">Targets from NextCommit. Exact differences are arithmetic, not evidence of a meaningful performance gap or a training prescription.</p></section>`;}
  function scenarioHtml(read,idx){return `<details class="pro-scenario no-print"><summary>What if my numbers change?</summary><p>Try hypothetical measurements. Your actual result and saved history stay unchanged. This does not forecast development.</p><div class="pro-scenario-inputs">${R.fields(read).map(([k,l,u])=>`<label>${esc(l)} (${esc(u)})<input class="input" type="number" inputmode="decimal" step="0.01" data-scenario="${idx}:${k}" value="${state.input.metrics[k]??''}" min="${CFG.RANGES[k].hard[0]}" max="${CFG.RANGES[k].hard[1]}"></label>`).join('')}</div><button class="btn btn-line" type="button" data-run-scenario="${idx}">Compare hypothetical numbers</button><p id="scenarioResult${idx}" role="status"></p></details>`;}
  function runScenario(idx){const patch={};const output=document.getElementById('scenarioResult'+idx);app.querySelectorAll(`[data-scenario^="${idx}:"]`).forEach(el=>{if(el.value!=='')patch[el.dataset.scenario.split(':')[1]]=Number(el.value);});try{const r=R.scenario(state.data,state.input,state.result.reads[idx],patch);const met=r.read.categories.filter(c=>c.highlighted);output.textContent='Hypothetical only: '+(met.length?'reaches the listed targets for '+met.map(c=>c.label).join(', '):'does not fully reach a listed category with these inputs')+'. Actual result unchanged.';}catch(error){output.textContent=error.message;}}
  function nextMovesHtml(read){return `<section class="pro-actions"><p class="pro-eyebrow">TURN A RESULT INTO ACTION</p><h3>Your next three moves</h3><ol>${R.actionPlan(state.input,read).map((a,k)=>`<li><span>${k+1}</span><div><h4>${esc(a.title)}</h4><p>${esc(a.detail)}</p>${a.href==='#edit-evidence'?'<button class="pro-text-button" type="button" data-edit-evidence>Edit measurement context</button>':a.href==='#target-workbench'?'<p class="lvl-note-sm">Use the target comparison above.</p>':`<a href="${esc(a.href)}">${a.href.includes('email')?'Open Email Coach':'Find colleges'}</a>`}</div></li>`).join('')}</ol><div class="pro-snapshot"><button type="button" class="btn btn-line" data-copy-snapshot="${state.result.reads.indexOf(read)}">Copy coach snapshot</button><textarea class="input" id="snapshotText${state.result.reads.indexOf(read)}" hidden readonly aria-label="Coach snapshot text"></textarea><p>No assigned-level claim is added to your email. Coaches see your actual measurements.</p></div></section>`;}

  function readHtml(read, idx) {
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
    const detail = `<div class="lvl-yours"><h4>Your numbers</h4><ul>${yours.map(([l, v, u]) => `<li><span>${esc(l)}</span><b>${v != null ? esc(fmtV(v, u)) : '<em>Not entered</em>'}</b></li>`).join("")}</ul>
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
      <h2 class="lvl-res-title" id="read${idx}" tabindex="-1">${esc(U.title(read))}</h2>
      <div class="lvl-head-card">
        <p class="lvl-head-k">Your benchmark snapshot${read.kind === "pitching" ? ` <span class="lvl-flag">Velocity comparison only</span>` : ""}</p>
        <p class="lvl-head">${esc(h.text)}</p>
        <p class="lvl-head-sup">${esc(h.support)}</p>
        <p class="lvl-head-cav">${esc(U.CAVEAT)}</p><p class="pro-source-note">Seven-category targets: <a href="https://www.nextcommit.ai/downloads/college-baseball-recruiting-standards-by-division.pdf" target="_blank" rel="noopener">NextCommit</a>. These publisher targets are one reference; the NCSA cross-check below stays separate.</p>
      </div>
      ${reportOverview(read, idx)}
      <div class="lvl-next"><p class="lvl-next-k">A benchmark to discuss</p><p class="lvl-next-t">${esc(nextFor(read))}</p></div>
      <div class="lvl-cta2 no-print"><div><p class="lvl-cta2-t">Make your next move.</p><p class="lvl-cta2-s">Use your actual numbers in a personal coach email.</p></div><button class="btn btn-peach" type="button" data-email-handoff="${idx}">Build my coach email</button></div>
      ${crossCheckHtml(read)}
      ${workbenchHtml(read, idx)}
      ${scenarioHtml(read, idx)}
      ${nextMovesHtml(read)}
      ${exploreHtml(read)}
      <div class="lvl-share no-print"><button class="btn btn-line" type="button" data-share="${idx}">Share my result</button><div class="lvl-share-out" id="shareOut${idx}" hidden></div></div>
      <div class="lvl-levels"><h3>Every level</h3>
        <ol class="lvl-lrow">${lv.map(l => `<li class="${ST_CLASS[l.status]}" data-level="${l.key}"><b>${esc(l.label)}</b><span>${esc(l.status)}</span></li>`).join("")}</ol>
        <p class="lvl-note-sm">D2, D3, NAIA and JUCO overlap; they are not a strict ladder. "Close" means at least one of your numbers meets that level's published target and at least one is below it.</p></div>
      ${numbersStrip(read)}
      ${sec("age-frame", "Same-grade, height and weight context", youngHtml(read, idx) + frameHtml(read, idx))}
      ${sec("levels", "All levels in detail", detail)}
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
    const how = `<p><b>Evidence policy:</b> NCAA rules are used for timing, MLB for definitions, NCSA for a separate guideline check, and the named original publishers for their own targets and samples. No offer odds, percentiles or growth forecasts are calculated.</p><p>We compare each number you enter with the published recruiting targets for your position at each level, using the edge of each published band as a provisional line. Averages of researched groups and college-player numbers are shown separately and never change a level's status.</p>
      <p><b>The rule used.</b> ${esc(rule)}</p>
      <ul class="lvl-list"><li><b>Meets targets:</b> passes the rule above.</li><li><b>Close:</b> at least one of your compared numbers meets that level's target and at least one is below it.</li><li><b>Below targets:</b> your compared numbers are all below that level's targets.</li><li><b>Needs more numbers:</b> targets exist, but too few of your numbers could be compared there.</li><li><b>No published target:</b> the source publishes no target for your position at that level.</li></ul>
      <p><b>Your headline</b> is the first level in the list that shows "Meets targets". <b>Next step</b> is the nearest level above it with a number below target, showing only that level's smallest gap relative to its target.</p>
      <h4>Notes on your results</h4><ul class="lvl-list">${r.reads.map(rd => rd.highlight.explain.map(e => `<li>${ds(e)}</li>`).join("")).join("")}</ul>
      <h4>Limitations</h4>
      <p>${esc(r.note)}</p>
      <ul class="lvl-list">${r.evidence.map(e => `<li>${ds(e.text)}</li>`).join("")}${r.stage.map(s => `<li>${ds(s)}</li>`).join("")}</ul>
      <h4>Missing information</h4>
      ${r.missing.length ? `<p><b>Not entered:</b> ${esc(r.missing.join(", "))}. Adding these can make the comparison more complete.</p>` : `<p>All core numbers for your position${r.reads.length > 1 ? "s" : ""} were entered.</p>`}
      ${i.meta.link ? `<p class="lvl-note-sm">Reference link: <span class="lvl-link">${esc(i.meta.link)}</span></p>` : ""}`;
    const addSrc = (state.add && state.add.sources || []).filter(s => s.id !== "PBR_WI_E");
    const sources = `<div class="lvl-legend" aria-label="Legend"><span class="lvl-kind guide">Published target</span> NextCommit recruiting guideline (used for level status) <span class="lvl-kind ref">Second source</span> NCSA guideline, shown for reference <span class="lvl-kind mean">Average</span> sample mean of a researched group <span class="lvl-kind ctx">College players</span> college norms, context only</div>
      <p class="lvl-note-sm">Benchmark data v${esc(r.dataVersion)}, research as of ${esc(r.researchAsOf)}. ${esc(r.interpretationNote)}</p>
      <h4>Rules, definitions and recruiting education</h4><ul class="lvl-list">${Research.sources.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener"><b>${esc(x.name)}</b></a> · ${esc(x.kind)}. ${esc(x.use)} <span>${esc(x.limit)}</span></li>`).join("")}</ul><p class="lvl-note-sm">Research checked ${esc(Research.checked)}. A linked source does not endorse this tool.</p>
      <h4>Original benchmark publishers</h4><ul class="lvl-list">${state.data.sources.filter(s => ["NC", "NS", "BP", "FG", "SL", "PC", "SEC"].includes(s.id)).map(s => `<li><b>${esc(s.publisher)}</b> (${esc(s.evidence_type)}, ${esc(s.publication_or_check)}): ${esc(s.limitation)} <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a></li>`).join("")}</ul>
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
      ${clockHtml()}
      ${progressHtml()}
      ${reviewHtml()}
      <div class="lvl-res-actions no-print"><button class="btn btn-line" type="button" data-go="1">Update my numbers</button><button class="btn btn-line" type="button" data-print>Print</button><button class="btn btn-line" type="button" data-reset>Start over</button></div>
      ${sec("sources", "Sources", sources)}
      ${sec("how", "How this works", how)}
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
    x.fillStyle = "#c9d2e3"; x.font = "600 44px Inter, sans-serif";
    x.fillText(h.level ? (read.kind === "pitching" ? "FASTBALL MEETS THE LISTED" : "NUMBERS MEET THE LISTED") : "WORKING TOWARD", W / 2, 1260);
    x.fillStyle = "#fff"; x.font = "128px Anton, Impact, sans-serif";
    const big = h.level ? (U.LONG[h.level] + (read.kind === "pitching" ? " velocity target" : " targets")).toUpperCase() : "THE PUBLISHED TARGETS";
    wrap(x, big, 960).slice(0, 3).forEach((ln, k) => x.fillText(ln, W / 2, 1400 + k * 136));
    x.fillStyle = "#8f9bb3"; x.font = "500 32px Inter, sans-serif";
    x.fillText("A benchmark comparison, not a prediction.", W / 2, 1720);
    x.fillStyle = "#ff8a4c"; x.font = "700 64px 'Barlow Condensed', sans-serif"; x.fillText("@peachstaterecruits", W / 2, 1820);
    return new Promise(res => cv.toBlob(b => res(b), "image/png"));
  }
  async function share(idx) {
    const read = state.result.reads[idx], out = document.getElementById("shareOut" + idx); if (!out) return;
    out.hidden = false; out.innerHTML = `<p class="lvl-note-sm">Making your image…</p>`;
    const blob = await storyBlob(read);
    const url = URL.createObjectURL(blob), name = `find-my-level-${read.position.toLowerCase()}.png`;
    const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    state.share = { blob, file, name };
    out.innerHTML = `<img src="${url}" alt="Your Find My Level story image" width="1080" height="1920">
      <div class="lvl-share-btns">${canShare ? `<button class="btn btn-peach" type="button" data-native="${idx}">Share…</button>` : ""}<a class="btn btn-line" href="${url}" download="${name}">Download image</a></div>
      <p class="lvl-note-sm">Made on your device. Nothing is uploaded.</p>`;
  }

  // ---------- v17 (v2): chips, same-age panel, clock, advanced, progress, review, print ----------
  const chipHtml = (key) => `<span class="lvl-chips-row">${V.chips(state.input, key).map(c => `<i class="lvl-chip${/Hand-timed/.test(c) ? " warn" : ""}">${esc(c)}</i>`).join("")}</span>${V.chipNote(state.input, key) ? `<small class="lvl-chip-note">${esc(V.chipNote(state.input, key))}</small>` : ""}`;
  const KEY_OF = { "Max fastball": "maxFb", "Typical game fastball": "typFb", "Max exit velocity": "maxEv", "60-yard dash": "sixty", "Catcher throw": "cVelo", "Best pop time": "pop", "Outfield throw": "ofVelo", "Infield throw": "ifVelo" };
  function numbersStrip(read) {
    const ys = yoursFor(read).filter(([, v]) => v != null);
    if (!ys.length) return "";
    return `<div class="lvl-nums"><h3>Your numbers</h3><ul>${ys.map(([l, v, u]) => `<li><span>${esc(l)}</span><b>${esc(fmtV(v, u))}</b>${chipHtml(KEY_OF[l])}</li>`).join("")}</ul></div>`;
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
      const entry = PG.entryFrom(state.input, state.result.reads.map(r => U.headline(r).level || ""));
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
      <p>We'll look at your numbers and reply on Instagram. Free, no obligation.</p>
      <button class="btn btn-peach" type="button" data-review-open>Send my numbers to Peach State for a free look</button>
      <div id="lvlReviewForm" class="lvl-review-form" hidden>
        <label for="f_igHandle">Your Instagram handle</label>
        <div class="lvl-review-row"><input class="input" id="f_igHandle" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="@yourhandle" maxlength="31"><button class="btn btn-peach" type="button" data-review-send>Send</button></div>
        <p class="lvl-note-sm">We'll send your handle, class, position, numbers, how they were measured and your headline result. Nothing else.</p>
        <p class="lvl-err" id="reviewErr" hidden></p>
      </div>`}
      <p class="lvl-privacy">Nothing leaves your browser unless you tap Send.</p></section>`;
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
      <p class="pr-cav">${esc(U.CAVEAT)} Benchmark data v${esc(r.dataVersion)}. Sources: NextCommit, NCSA, BaseballPath, Flatground, Slammers, Pitching Coach U, PBR. Numbers are self-reported.</p>
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
    if (!hasP()) i.metrics.repertoire = [];
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
    app.innerHTML = state.step === 1 ? step1(v) : state.step === 2 ? step2(v) : state.step === 3 ? step3(v) : results();
    openSecs.forEach(k => { const [r, sct] = k.includes(":") ? k.split(":") : [null, k]; const d = app.querySelector(r != null ? `[data-read="${r}"] [data-sec="${sct}"]` : `.lvl-results > [data-sec="${sct}"]`); if (d) d.open = true; });
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
    if (state.step === 3) { state.result = L.evaluate(state.data, state.input); state.step = 4; state.tab = 0; saveProgress(); }
    else state.step += 1;
    render(NOV, true);
  });
  app.addEventListener("click", (e) => {
    const eh = e.target.closest("[data-email-handoff]");
    if(eh){try{sessionStorage.setItem("psr_email_handoff_v2",JSON.stringify(R.handoff(state.input,state.result.reads[+eh.dataset.emailHandoff])));location.href="email-coach.html?from=level";}catch(error){if(window.PSR)window.PSR.toast("This browser cannot transfer your numbers. Open Email Coach and enter them there.");}return;}
    const cp=e.target.closest("[data-copy-snapshot]");if(cp){const text=R.snapshot(state.input,state.result.reads[+cp.dataset.copySnapshot]);Promise.resolve().then(()=>navigator.clipboard.writeText(text)).then(()=>window.PSR&&window.PSR.toast("Coach snapshot copied")).catch(()=>{const out=document.getElementById("snapshotText"+cp.dataset.copySnapshot);out.hidden=false;out.value=text;out.focus();out.select();});return;}
    const sc=e.target.closest("[data-run-scenario]");if(sc){runScenario(+sc.dataset.runScenario);return;}
    const edit=e.target.closest('[data-edit-evidence]');if(edit){go(3);return;}
    const tb = e.target.closest("[data-tab]"); if (tb) { selectTab(+tb.dataset.tab, true); return; }
    const sh = e.target.closest("[data-share]"); if (sh) { share(+sh.dataset.share); return; }
    const nv = e.target.closest("[data-native]"); if (nv && state.share) { navigator.share({ files: [state.share.file], title: "Find My Level", text: "My college baseball benchmark comparison. @peachstaterecruits" }).catch(() => {}); return; }
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
  Promise.all([getJson(CFG.DATA_URL + "?v=1.0"), getJson(CFG.ADDITIONS_URL + "?v=1.1").catch(() => null), getJson(CFG.SIZE_URL + "?v=1").catch(() => null)]).then(([d, a, z]) => {
    state.data = d; state.add = a; state.size = z; render();
  }).catch(() => { app.innerHTML = `<p class="lvl-card">The benchmark data couldn't load. Please refresh the page.</p>`; });

  window.PSRLevelUI = { state }; // for tests only; holds nothing outside this page
})();
