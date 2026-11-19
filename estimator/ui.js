/*
  College Baseball Level Estimator: interface. Uses PSRLevel (logic) and PSRLevelConfig (config).
  Everything stays in memory on this page: no storage, no analytics, no network calls except
  loading the static benchmark data file.
*/
(function () {
  "use strict";
  const L = window.PSRLevel, CFG = window.PSRLevelConfig, S = L.S;
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
    slg:       { label: "Slugging", unit: "", kind: "ratio", hint: "For example .510" }
  };
  const PITCHES = ["Four-seam fastball", "Two-seam / sinker", "Curveball", "Slider", "Sweeper", "Changeup", "Cutter", "Splitter", "Knuckle-curve", "Other"];
  const ENV = [["", "I don't know"], ["game", "Game"], ["showcase", "Showcase"], ["bullpen", "Bullpen"], ["facility", "Facility / training"], ["tee", "Tee"], ["front_toss", "Front toss"], ["live_bp", "Live BP"]];
  const METHOD = [["", "I don't know"], ["radar", "Radar gun"], ["trackman", "TrackMan"], ["rapsodo", "Rapsodo"], ["sensor", "Bat or ball sensor"], ["electronic", "Laser / electronic timing"], ["hand", "Hand-held stopwatch"]];
  const SOURCE = [["self", "Self-reported"], ["event", "Event or showcase result"], ["device", "Device report"], ["", "I don't know"]];
  const IF = ["1B", "2B", "SS", "3B"], OF = ["LF", "CF", "RF"];
  const TOOL_LABEL = { hitting: "Hitting", running: "Running", throwing: "Throwing", pitching: "Fastball" };

  // ---------- State (memory only) ----------
  const state = {
    step: 1, data: null, result: null, confirmed: new Set(), gapCat: {},
    raw: {}, unknown: new Set(),
    input: { age: null, gradYear: null, primary: "", secondary: "", throws: "", bats: "", heightIn: null, weightLb: null, metrics: { repertoire: [] }, meta: { date: "", environment: "", method: "", source: "", link: "" } }
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
  const STEP1 = ["age", "gradYear", "primary", "secondary", "throws", "bats", "heightIn", "weightLb"];
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
        <div class="lvl-field${v.errors.some(x => x.field === "age") || v.warnings.some(x => x.field === "age") ? " is-invalid" : ""}" data-wrap="age"><label for="f_age">Age when measured</label>
          <div class="lvl-input-unit"><input class="input" id="f_age" data-plain="age" inputmode="numeric" autocomplete="off" value="${esc(state.raw.age != null ? state.raw.age : (i.age != null ? i.age : ""))}"><span class="lvl-unit" aria-hidden="true">years</span></div>${errorsFor("age", v)}</div>
        ${select("gradYear", "Graduation year", years, i.gradYear != null ? i.gradYear : "", v)}
        ${select("primary", "Primary position", pos, i.primary, v)}
        ${select("secondary", "Second position", pos2, i.secondary, v, { optional: true, hint: "Two-way? Pick Pitcher here (or as primary) for a separate pitching read." })}
      </div>
      <div class="lvl-grid">
        ${seg("throws", "Throws", [["R", "Right"], ["L", "Left"]], i.throws, v, true)}
        ${seg("bats", "Bats", [["R", "Right"], ["L", "Left"], ["S", "Switch"]], i.bats, v, true)}
      </div>
      <details class="lvl-more" ${i.heightIn != null || i.weightLb != null ? "open" : ""}><summary>Height and weight <span class="lvl-opt">optional context</span></summary>
        <p class="lvl-hint">Shown for context only. Height and weight never change the level comparison.</p>
        <div class="lvl-grid">
          <div class="lvl-field${v.errors.some(x => x.field === "heightIn") || v.warnings.some(x => x.field === "heightIn") ? " is-invalid" : ""}" data-wrap="heightIn"><span class="lvl-label" id="hLbl">Height</span><div class="lvl-pair">
            <select class="select" id="f_heightIn" data-h="ft" aria-labelledby="hLbl">${ft.map(([a, b]) => `<option value="${a}" ${hFt === a ? "selected" : ""}>${b}</option>`).join("")}</select>
            <select class="select" data-h="in" aria-label="Height, inches">${inch.map(([a, b]) => `<option value="${a}" ${hIn === a ? "selected" : ""}>${b}</option>`).join("")}</select></div>${errorsFor("heightIn", v)}</div>
          <div class="lvl-field${v.errors.some(x => x.field === "weightLb") || v.warnings.some(x => x.field === "weightLb") ? " is-invalid" : ""}" data-wrap="weightLb"><label for="f_weightLb">Weight</label><div class="lvl-input-unit"><input class="input" id="f_weightLb" data-plain="weightLb" inputmode="numeric" autocomplete="off" value="${esc(state.raw.weightLb != null ? state.raw.weightLb : (i.weightLb != null ? i.weightLb : ""))}"><span class="lvl-unit" aria-hidden="true">lb</span></div>${errorsFor("weightLb", v)}</div>
        </div>
      </details>
      <div class="lvl-actions"><span></span><button class="btn btn-peach btn-lg" type="submit">Next: your numbers</button></div>
    </form>`;
  }

  function step2Fields() {
    const f = [];
    if (hasP()) f.push("maxFb", "typFb", "strikePct", "era", "whip");
    if (hasField()) {
      f.push("maxEv", "sixty", "avgEv", "thirty", "avg", "obp", "slg");
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
        <details class="lvl-more"><summary>Add more information <span class="lvl-opt">control and results, optional</span></summary><div class="lvl-grid">${numField("strikePct", v, { optional: true })}${numField("era", v, { optional: true })}${numField("whip", v, { optional: true })}</div></details>
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
        <details class="lvl-more"><summary>Add more information <span class="lvl-opt">optional</span></summary><div class="lvl-grid">${numField("avgEv", v, { optional: true })}${numField("thirty", v, { optional: true })}${numField("avg", v, { optional: true })}${numField("obp", v, { optional: true })}${numField("slg", v, { optional: true })}</div></details>
      </fieldset>`);
    }
    return `<form class="lvl-card lvl-form" data-step="2" novalidate>
      <h2>Your current numbers</h2>
      <p class="lvl-sub">Enter what you know. Leave a box blank or tick "I don't know" if you don't have it. Blank is treated as unknown, never as zero.</p>
      ${summary(v, fs)}
      ${parts.join("")}
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

  function toolRow(k, t) {
    const val = t.value != null ? `<span class="lvl-you">You: ${esc(fmtV(t.value, t.unit))}</span>` : "";
    const tgt = t.band && t.status !== S.NO_BENCH ? `<span class="lvl-tgt">Target: ${esc(t.band)}${t.qualifier && /open|least|single|says/i.test(t.qualifier) ? ` <small>(${esc(t.qualifier)})</small>` : ""}</span>` : "";
    const extra = t.status === S.BELOW ? `<span class="lvl-gap">${t.unit === "seconds" ? esc(t.gap.toFixed(2)) + " s slower than" : esc(t.gap) + " mph short of"} the listed ${t.unit === "seconds" ? esc(t.threshold.toFixed(2)) + " s" : esc(t.threshold) + " mph"} mark</span>` : "";
    return `<li class="lvl-tool">
      <div class="lvl-tool-top"><b>${esc(TOOL_LABEL[k])}</b><span class="lvl-pill ${pillClass(t.status)}">${esc(t.status)}</span></div>
      <div class="lvl-tool-meta">${val}${tgt}${extra}</div>
      ${t.note ? `<p class="lvl-note-sm">${esc(t.note)}</p>` : ""}
      ${(t.status === S.NO_BENCH || t.status === S.REF_ONLY || t.status === S.NOT_COMP) && t.reason ? `<p class="lvl-note-sm">${esc(t.reason)}${t.status === S.REF_ONLY && t.band ? ` Source value: ${esc(t.band)}.` : ""}</p>` : ""}
      ${t.pooledGroup ? `<p class="lvl-note-sm">Source combines NAIA and JUCO for this target.</p>` : ""}
    </li>`;
  }

  function catCard(read, c) {
    const comp = c.compared.map(k => TOOL_LABEL[k]), miss = c.missing.map(x => TOOL_LABEL[x.tool]);
    const noData = read.kind === "position" && c.key === "low";
    const ns = c.nsRef ? `<div class="lvl-ns"><span class="lvl-kind ref">NCSA reference</span> <b>${esc(c.nsRef.label)}</b> <small>(NCSA group: ${esc(c.nsRef.sourceLevel)})</small>
      <div class="lvl-tool-meta"><span class="lvl-pill ${pillClass(c.nsRef.cmp.status)}">${esc(c.nsRef.cmp.status)}</span>${c.nsRef.cmp.band && c.nsRef.cmp.status !== S.NO_BENCH ? `<span class="lvl-tgt">Target: ${esc(c.nsRef.cmp.band)}</span>` : ""}</div>
      ${c.nsRef.cmp.status === S.NO_BENCH ? `<p class="lvl-note-sm">${esc(c.nsRef.cmp.reason)}</p>` : ""}${c.nsRef.pooledNote ? `<p class="lvl-note-sm">${esc(c.nsRef.pooledNote)}</p>` : ""}
      <p class="lvl-note-sm">Separate guideline source. Shown for reference; not used for the range.</p></div>` : "";
    const open = window.matchMedia && window.matchMedia("(min-width: 721px)").matches;
    return `<details class="lvl-cat${c.highlighted ? " is-hl" : ""}" data-cat="${c.key}"${open ? " open" : ""}>
      <summary><span class="lvl-cat-h"><h4>${esc(c.label)}</h4>${c.highlighted ? `<span class="lvl-badge">${read.kind === "pitching" ? "Velocity match" : "In provisional range"}</span>` : ""}</span>
        <span class="lvl-mini">${read.toolKeys.map(k => `<span><b>${esc(TOOL_LABEL[k])}</b> <i class="lvl-pill ${pillClass(c.tools[k].status)}">${esc(c.tools[k].status)}</i></span>`).join("")}</span>
        <span class="lvl-more-k" aria-hidden="true">Details</span></summary>
      <p class="lvl-src"><span class="lvl-kind guide">Guideline</span> NextCommit category: ${esc(c.ncLabel)}</p>
      ${noData ? `<p class="lvl-note-sm"><b>NextCommit publishes no lower D1 targets for position players.</b> This is a data gap, not a negative result. Nothing is borrowed from mid-major or Other D1 numbers.</p>` : ""}
      <ul class="lvl-tools">${read.toolKeys.map(k => toolRow(k, c.tools[k])).join("")}</ul>
      <p class="lvl-cov"><b>Compared:</b> ${comp.length ? esc(comp.join(", ")) : "none"}${miss.length ? ` · <b>Missing:</b> ${esc(miss.join(", "))}` : ""}</p>
      ${ns}
    </details>`;
  }

  function panelHtml(p) {
    const rows = p.rows.map(r => {
      const cells = r.notComparable ? `<p class="lvl-pill na">${esc(S.NOT_COMP)}</p><p class="lvl-note-sm">${esc(r.notComparable)}</p>${r.cells.length ? `<ul class="lvl-means">${r.cells.map(c => `<li><span>${esc(c.col)}</span><b>${c.mean == null ? "Not published" : esc(fmtV(c.mean, r.unit))}</b></li>`).join("")}</ul>` : ""}`
        : `<ul class="lvl-means">${r.cells.map(c => {
          if (c.status === S.NO_BENCH) return `<li><span>${esc(c.col)}</span><b>—</b><em class="na">${esc(S.NO_BENCH)}</em></li>`;
          if (c.status === S.NO_INPUT) return `<li><span>${esc(c.col)}</span><b>${esc(fmtV(c.mean, r.unit))}</b><em class="none">Not entered</em></li>`;
          const d = r.unit === "seconds" ? c.absDiff.toFixed(2) + " s" : r.unit === "ratio" ? c.absDiff.toFixed(3).replace(/^0/, "") : r.unit === "percent" ? Math.round(c.absDiff * 1000) / 10 + " pts" : (Math.round(c.absDiff * 10) / 10) + (r.unit === "mph" ? " mph" : "");
          return `<li><span>${esc(c.col)}</span><b>${esc(fmtV(c.mean, r.unit))}</b><em class="${c.favorable === true ? "ok" : c.favorable === false ? "below" : "na"}">${esc(c.status)}${c.absDiff ? ` by ${esc(d)}` : ""}</em></li>`;
        }).join("")}</ul>`;
      return `<div class="lvl-prow"><div class="lvl-prow-h"><b>${esc(r.label)}</b>${r.value != null ? `<span class="lvl-you">You: ${esc(fmtV(r.value, r.unit))}</span>` : ""}<small>${r.direction === "lower_is_better" ? "Lower is better" : "Higher is better"}</small></div>${cells}${(r.caveats || []).map(c => `<p class="lvl-note-sm">${esc(c)}</p>`).join("")}</div>`;
    }).join("");
    return `<details class="lvl-panel"><summary><span class="lvl-kind mean">Sample mean</span> ${esc(p.title)}</summary>
      <p class="lvl-note-sm">${esc(p.population)} Source: <a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.source.publisher)}</a> (${esc(p.source.publication_or_check)}). ${esc(p.source.limitation)}</p>
      ${p.note ? `<p class="lvl-note-sm"><b>${esc(p.note)}</b></p>` : ""}
      <p class="lvl-note-sm">A mean is the average of that group, not a pass/fail line. Being below it doesn't rule you out.</p>
      ${rows}</details>`;
  }

  function collegeHtml(c) {
    if (!c) return "";
    return `<details class="lvl-panel"><summary><span class="lvl-kind ctx">College norm</span> ${esc(c.title)}</summary>
      <p class="lvl-note-sm"><b>${esc(c.warning)}</b></p>
      <p class="lvl-note-sm">${esc(c.valueNote)}</p>
      <ul class="lvl-means">${c.rows.map(r => `<li><span>${esc(r.level)} ${esc(r.hand)}</span><b>${esc(r.mean)} mph</b><em class="na">${r.diff == null ? `n: ${esc(r.sample)}` : `You ${r.diff >= 0 ? "+" : ""}${esc(r.diff)} mph · n: ${esc(r.sample)}`}</em></li>`).join("")}</ul>
      <p class="lvl-note-sm">Source: <a href="${esc(c.source.url)}" target="_blank" rel="noopener">${esc(c.source.publisher)}</a>. ${esc(c.source.limitation)}</p>
      <p class="lvl-note-sm">${esc(c.sec.text)} Source: <a href="${esc(c.sec.source.url)}" target="_blank" rel="noopener">${esc(c.sec.source.publisher)}</a>.</p></details>`;
  }

  function readHtml(read, idx, res) {
    const title = read.kind === "pitching" ? `Pitching read${read.hand ? " (" + read.hand + ")" : ""}` : `Position read: ${read.position}`;
    const hlCats = read.categories.filter(c => c.highlighted);
    const gapCat = state.gapCat[idx] || (read.categories.find(c => !c.highlighted && c.compared.length) || read.categories[0]).key;
    const gaps = L.gapsTo(read, gapCat);
    const strengths = read.strengths.map(s => {
      const metLabels = s.met.map(k => CFG.CATEGORIES.find(c => c.key === k).label);
      if (!s.met.length) return `<li><b>${esc(TOOL_LABEL[s.tool])}:</b> below every listed target we could compare.</li>`;
      return `<li><b>${esc(TOOL_LABEL[s.tool])}:</b> meets the listed target for ${esc(metLabels.join(", "))}.</li>`;
    });
    const m = state.input.metrics;
    const yours = read.kind === "pitching" ? [["Max fastball", m.maxFb, "mph"], ["Typical game fastball", m.typFb, "mph"]]
      : [["Max exit velocity", m.maxEv, "mph"], ["60-yard dash", m.sixty, "seconds"]].concat(read.family === "C" ? [["Catcher throw", m.cVelo, "mph"], ["Best pop time", m.pop, "seconds"]] : read.family === "OF" ? [["Outfield throw", m.ofVelo, "mph"]] : [["Infield throw", m.ifVelo, "mph"]]);
    return `<section class="lvl-read" aria-labelledby="read${idx}">
      <div class="lvl-read-head">
        <h3 id="read${idx}">${esc(title)}</h3>
        ${read.kind === "pitching" ? `<span class="lvl-flag">Velocity comparison only</span>` : ""}
      </div>
      <div class="lvl-range${read.highlight.hasRange ? "" : " is-empty"}">
        <p class="lvl-range-k">Provisional comparison range</p>
        ${read.highlight.hasRange ? `<ul class="lvl-range-list">${hlCats.map(c => `<li>${esc(c.label)}</li>`).join("")}</ul>` : `<p class="lvl-range-none">More information needed for an overall range</p>`}
        <ul class="lvl-explain">${read.highlight.explain.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
        ${read.kind === "position" ? `<p class="lvl-note-sm">Rule used: a level is listed only when at least ${CFG.HIGHLIGHT_RULE.minDistinctCoreTools} different core tools have NextCommit targets there and every compared tool meets its target. This is a product rule, not a validated prediction.</p>` : `<p class="lvl-note-sm">Levels are listed where your fastball meets NextCommit's listed velocity target. Velocity is one part of a pitcher evaluation.</p>`}
      </div>
      <div class="lvl-yours"><h4>Your numbers</h4><ul>${yours.map(([l, v, u]) => `<li><span>${esc(l)}</span><b>${v != null ? esc(fmtV(v, u)) : '<em>Unknown</em>'}</b></li>`).join("")}</ul>
        ${read.kind === "pitching" && (m.repertoire || []).length ? `<p class="lvl-note-sm">Repertoire: ${esc(m.repertoire.join(", "))}. Needs evaluation on video; no numeric targets exist.</p>` : ""}</div>
      <h4 class="lvl-h4">All seven categories <small>NextCommit guideline targets</small></h4>
      <p class="lvl-note-sm">"Meets listed target" uses the edge of each published band as a provisional threshold. That is our implementation choice, not a researched average or an official cutoff. Testing context for these targets is unspecified.</p>
      <div class="lvl-cats">${read.categories.map(c => catCard(read, c)).join("")}</div>
      <div class="lvl-two">
        <div class="lvl-box"><h4>Strongest supported tools</h4>${strengths.length ? `<ul class="lvl-list">${strengths.join("")}</ul>` : `<p class="lvl-note-sm">No tool could be compared with a listed target yet.</p>`}</div>
        <div class="lvl-box"><h4>Gaps to a listed target</h4>
          <label class="lvl-label" for="gap${idx}">Compare with</label>
          <select class="select" id="gap${idx}" data-gap="${idx}">${read.categories.map(c => `<option value="${c.key}" ${c.key === gapCat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
          <ul class="lvl-list">${gaps.map(g => `<li><b>${esc(TOOL_LABEL[g.tool])}:</b> ${esc(g.text)}</li>`).join("")}</ul>
          <p class="lvl-note-sm">Closing a gap doesn't guarantee interest or an offer.</p></div>
      </div>
      <h4 class="lvl-h4">Supporting numbers <small>observed averages, kept separate by source</small></h4>
      ${read.panels.map(panelHtml).join("")}${collegeHtml(read.college)}
    </section>`;
  }

  function results() {
    const r = state.result, i = state.input;
    const ctx = [];
    if (i.heightIn != null) ctx.push(`${Math.floor(i.heightIn / 12)}' ${i.heightIn % 12}"`);
    if (i.weightLb != null) ctx.push(`${i.weightLb} lb`);
    return `<div class="lvl-results">
      <div class="lvl-card lvl-res-head">
        <h2>Your comparison</h2>
        <p class="lvl-sub">${esc(positions().join(" / "))} · Class of ${esc(i.gradYear)} · Throws ${esc(i.throws)} · Bats ${esc(i.bats)}${ctx.length ? ` · ${esc(ctx.join(", "))} (context only)` : ""}</p>
        ${r.twoWay ? `<p class="lvl-note-sm"><b>Two-way player:</b> pitching and position play are compared separately. They are never blended into one result.</p>` : ""}
        <div class="lvl-legend" aria-label="Legend"><span class="lvl-kind guide">Guideline</span> published recruiting target <span class="lvl-kind mean">Sample mean</span> average of a researched group <span class="lvl-kind ref">NCSA reference</span> separate guideline source <span class="lvl-kind ctx">College norm</span> players already in college, context only</div>
        <div class="lvl-res-actions no-print"><button class="btn btn-peach" type="button" data-go="1">Update my numbers</button><button class="btn btn-line" type="button" data-print>Print</button><button class="btn btn-line" type="button" data-reset>Start over</button></div>
      </div>
      ${r.reads.map((rd, k) => readHtml(rd, k, r)).join("")}
      <section class="lvl-card lvl-ev" aria-labelledby="evTitle">
        <h3 id="evTitle">Missing information and evidence quality</h3>
        ${r.missing.length ? `<p><b>Not entered:</b> ${esc(r.missing.join(", "))}. Adding these can make the comparison more complete.</p>` : `<p>All core numbers for your position${r.reads.length > 1 ? "s" : ""} were entered.</p>`}
        <ul class="lvl-list">${r.evidence.map(e => `<li>${esc(e.text)}</li>`).join("")}${r.stage.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        ${i.meta.link ? `<p class="lvl-note-sm">Reference link: <span class="lvl-link">${esc(i.meta.link)}</span></p>` : ""}
      </section>
      <p class="lvl-final">${esc(r.note)}</p>
      <details class="lvl-panel lvl-sources"><summary>Sources and data version</summary>
        <p class="lvl-note-sm">Benchmark data v${esc(r.dataVersion)}, research as of ${esc(r.researchAsOf)}. ${esc(r.interpretationNote)}</p>
        <ul class="lvl-list">${state.data.sources.filter(s => ["NC", "NS", "BP", "FG", "SL", "PC", "SEC"].includes(s.id)).map(s => `<li><b>${esc(s.publisher)}</b> (${esc(s.evidence_type)}, ${esc(s.publication_or_check)}): ${esc(s.limitation)} <a href="${esc(s.url)}" target="_blank" rel="noopener">Source</a></li>`).join("")}</ul>
      </details>
      <div class="lvl-card lvl-cta no-print"><div><h3>Want coaches to see your film?</h3><p>Peach State Recruits builds Instagram features, highlight videos and recruiting profiles for baseball players.</p></div><a class="btn btn-peach btn-lg" href="index.html#packages">See packages</a></div>
    </div>`;
  }

  // ---------- Input collection ----------
  function collect() {
    const i = state.input;
    app.querySelectorAll("[data-plain]").forEach(el => { state.raw[el.dataset.plain] = el.value; });
    app.querySelectorAll("[data-sel]").forEach(el => {
      const k = el.dataset.sel, v = el.value;
      if (k === "gradYear") i.gradYear = v ? parseInt(v, 10) : null;
      else if (k === "environment" || k === "method") i.meta[k] = v;
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
    plain("age", "number"); plain("weightLb", "number");
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
    app.innerHTML = state.step === 1 ? step1(v) : state.step === 2 ? step2(v) : state.step === 3 ? step3(v) : results();
    const sum = document.getElementById("lvlSummary");
    if (sum) sum.focus();
    else if (focus) { const h = app.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } const top = document.querySelector(".lvl-main"); if (top) window.scrollTo({ top: top.getBoundingClientRect().top + window.scrollY - 80, behavior: "auto" }); }
  }

  function go(step) { collect(); state.step = step; render(NOV, true); }

  app.addEventListener("submit", (e) => {
    e.preventDefault();
    collect();
    const v = check(state.step);
    if (v.errors.length || v.warnings.length) { render(v); return; }
    if (state.step === 3) { state.result = L.evaluate(state.data, state.input); state.step = 4; }
    else state.step += 1;
    render(NOV, true);
  });
  app.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); go(+g.dataset.go); return; }
    if (e.target.closest("[data-print]")) { app.querySelectorAll("details").forEach(d => d.open = true); window.print(); return; }
    if (e.target.closest("[data-reset]")) { location.href = location.pathname; return; }
    const f = e.target.closest("[data-focus]"); if (f) { e.preventDefault(); const el = document.getElementById("f_" + f.dataset.focus) || app.querySelector(`[name="${f.dataset.focus}"]`); if (el) el.focus(); }
  });
  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.unknown) {
      const k = t.dataset.unknown; collect();
      if (t.checked) { state.unknown.add(k); if (k !== "date") state.raw[k] = ""; } else state.unknown.delete(k);
      const inp = document.getElementById("f_" + k); if (inp) { inp.disabled = t.checked; if (t.checked) inp.value = ""; else inp.focus(); }
      return;
    }
    if (t.dataset.confirm) { t.checked ? state.confirmed.add(t.dataset.confirm) : state.confirmed.delete(t.dataset.confirm); return; }
    if (t.dataset.gap != null) { state.gapCat[t.dataset.gap] = t.value; const y = window.scrollY; render(NOV); window.scrollTo(0, y); const s = document.getElementById("gap" + t.dataset.gap); if (s) s.focus({ preventScroll: true }); }
  });

  // ---------- Boot ----------
  fetch(CFG.DATA_URL + "?v=1.0", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
    state.data = d; render();
  }).catch(() => { app.innerHTML = `<p class="lvl-card">The benchmark data couldn't load. Please refresh the page.</p>`; });

  window.PSRLevelUI = { state }; // for tests only; holds nothing outside this page
})();
