/*
  College Baseball Level Estimator: comparison logic (pure functions, no DOM).
  Works in the browser (window.PSRLevel) and in Node (require) for tests.

  Rules followed (from the research package):
  - Blank / "I don't know" is unknown (null), never zero. All-unknown never produces a division.
  - Guidelines (NC, NCSA), observed sample means (BP, FG, SL) and college-player norms (PC, SEC)
    are kept apart. Only NC guidelines feed the provisional range rule (see config HIGHLIGHT_RULE).
  - Guideline "meets" uses the JSON's provisional_comparison_threshold (tagged as an
    implementation interpretation). Exceeding a favorable boundary is never penalized.
  - Means are never pass/fail: we report above/below the sample mean and the difference.
  - Missing benchmarks stay missing (no zero, no interpolation, no borrowing).
  - Sources are never pooled or averaged. Pooled source groups stay labeled as pooled.
  - Height, weight, GPA and evidence quality never change the athletic comparison.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./config.js"));
  else root.PSRLevel = factory(root.PSRLevelConfig);
})(typeof self !== "undefined" ? self : this, function (CFG) {
  "use strict";

  const S = {
    MEETS: "Meets listed target",
    BELOW: "Below listed target",
    NO_BENCH: "No published benchmark",
    NOT_COMP: "Not comparable",
    REF_ONLY: "Source reference only",
    NO_INPUT: "Not entered"
  };
  const EPS = 1e-9;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fmt = (v, unit) => {
    if (!isNum(v)) return "";
    if (unit === "seconds") return v.toFixed(2) + " s";
    if (unit === "mph") return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + " mph";
    if (unit === "ratio") return v.toFixed(3).replace(/^0/, "");
    if (unit === "percent") return round(v * 100, 1) + "%";
    if (unit === "inches") return v + " in";
    if (unit === "lb") return v + " lb";
    if (unit === "rpm") return Math.round(v) + " rpm";
    if (unit === "ft") return v + " ft";
    return String(v);
  };

  // ---------- Input parsing ----------
  // Returns { value: number|null, error: string|null }. Blank means unknown (null).
  function parseEntry(raw, kind) {
    const s = raw == null ? "" : String(raw).trim();
    if (s === "") return { value: null, error: null };
    if (kind === "seconds") {
      if (/[:'"]/.test(s)) return { value: null, error: "Enter seconds as a decimal number, like 6.85 (not 6:85)." };
      if (/^\d{3,4}$/.test(s)) return { value: null, error: "That looks like it is missing a decimal point. Enter seconds like 6.85." };
      if (!/^\d{1,2}(\.\d{1,3})?$/.test(s)) return { value: null, error: "Enter seconds as a decimal number, like 6.85." };
      const v = parseFloat(s);
      if (!s.includes(".") && v >= 12) return { value: null, error: "That looks like it is missing a decimal point. Enter seconds like 6.85." };
      return { value: v, error: null };
    }
    if (kind === "percent") {
      const t = s.replace(/%$/, "").trim();
      if (!/^\d{1,3}(\.\d+)?$/.test(t)) return { value: null, error: "Enter a percentage from 0 to 100, like 62." };
      return { value: parseFloat(t), error: null };
    }
    if (kind === "ratio") {
      if (!/^(\d)?\.\d{1,3}$|^[01](\.0+)?$|^\d\.\d{1,3}$/.test(s)) return { value: null, error: "Enter it like .345 (three decimals)." };
      return { value: parseFloat(s), error: null };
    }
    if (kind === "rpm") {
      const t = s.replace(/,/g, "");
      if (!/^\d{3,4}$/.test(t)) return { value: null, error: "Enter spin as a whole number, like 2150." };
      return { value: parseInt(t, 10), error: null };
    }
    if (kind === "signed") {
      if (!/^-?\d{1,2}(\.\d{1,2})?$/.test(s)) return { value: null, error: "Enter a number, like 16.5 or -3." };
      return { value: parseFloat(s), error: null };
    }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return { value: null, error: "Enter a number, like 84 or 84.5." };
    return { value: parseFloat(s), error: null };
  }

  // ---------- Validation ----------
  // input: see README / ui.js. confirmed: Set of field names the player confirmed as correct.
  function validate(input, confirmed) {
    confirmed = confirmed || new Set();
    const errors = [], warnings = [];
    const err = (field, msg) => errors.push({ field, msg });
    const warn = (field, msg) => { if (!confirmed.has(field)) warnings.push({ field, msg }); };
    const m = input.metrics || {};
    const range = (field, v, key, label) => {
      const r = CFG.RANGES[key]; if (!isNum(v) || !r) return;
      if (v < r.hard[0] || v > r.hard[1]) err(field, `${label} of ${v} ${r.unit} is outside the possible range (${r.hard[0]}–${r.hard[1]}). Please check it.`);
      else if (r.soft && (v < r.soft[0] || v > r.soft[1])) warn(field, `${label} of ${v} ${r.unit} is unusual. Please double-check it, or confirm it is correct.`);
    };
    if (!isNum(input.gradYear)) err("gradYear", "Enter graduation year.");
    else if (!Number.isInteger(input.gradYear)) err("gradYear", "Graduation year must be a whole year.");
    else range("gradYear", input.gradYear, "gradYear", "Graduation year");
    if (!CFG.POSITIONS.some(p=>p.code===input.primary)) err("primary", "Choose a valid primary position.");
    if (input.secondary && input.secondary === input.primary) err("secondary", "Second position must be different from the primary position.");
    if (!["R","L"].includes(input.throws)) err("throws", "Choose a throwing hand.");
    if (!["R","L","S"].includes(input.bats)) err("bats", "Choose a batting side.");
    // Height and weight are required (owner decision, v18) but are context only: they never reach
    // the comparison or the highlight rule.
    if (!isNum(input.heightIn)) err("heightIn", "Enter height (feet and inches).");
    else range("heightIn", input.heightIn, "heightIn", "Height");
    if (!isNum(input.weightLb)) err("weightLb", "Enter weight in pounds.");
    else range("weightLb", input.weightLb, "weightLb", "Weight");

    const L = {
      maxFb: "Max fastball", typFb: "Typical game fastball", maxEv: "Max exit velocity", avgEv: "Average exit velocity",
      sixty: "60-yard time", thirty: "30-yard time", ifVelo: "Infield throwing velocity", ofVelo: "Outfield throwing velocity",
      cVelo: "Catcher throwing velocity", pop: "Pop time", avg: "Batting average", obp: "On-base percentage", slg: "Slugging",
      era: "ERA", whip: "WHIP", strikePct: "Strike rate",
      fbSpin: "Fastball spin", bbSpin: "Breaking-ball spin", extension: "Extension", ivb: "Induced vertical break", batSpeed: "Bat speed"
    };
    Object.keys(L).forEach(k => range(k, m[k], k, L[k]));
    if (isNum(m.typFb) && isNum(m.maxFb) && m.typFb > m.maxFb) err("typFb", "Typical game fastball can't be higher than your max fastball. Please correct one of them.");
    if (isNum(m.avgEv) && isNum(m.maxEv) && m.avgEv > m.maxEv) err("avgEv", "Average exit velocity can't be higher than your max exit velocity. Please correct one of them.");
    if (isNum(m.slg) && isNum(m.avg) && m.slg < m.avg) err("slg", "Slugging can't be lower than batting average. Please check both.");
    if (isNum(m.obp) && isNum(m.avg) && m.obp < m.avg) warn("obp", "On-base percentage is usually at least your batting average. Please check it, or confirm it is correct.");
    if (isNum(m.thirty) && isNum(m.sixty) && m.thirty >= m.sixty) err("thirty", "Your 30-yard time can't be slower than your 60-yard time.");

    const meta = input.meta || {};
    if (meta.date) {
      const d = new Date(meta.date + "T12:00:00");
      if (isNaN(d) || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")!==meta.date) err("date", "Enter a valid measurement date.");
      else if (meta.date > [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,"0"), String(new Date().getDate()).padStart(2,"0")].join("-")) err("date", "Measurement date can't be in the future.");
    }
    if (meta.link && !/^https?:\/\/\S+\.\S+/.test(meta.link)) err("link", "Enter a full link starting with https://, or leave it blank.");
    return { errors, warnings, ok: errors.length === 0 && warnings.length === 0 };
  }

  // ---------- Data access ----------
  function targetRow(data, src, level, pos, metric) {
    if (!level || !pos) return null;
    return data.recruit_target_records.find(r => r.source_id === src && r.source_level_label === level && r.source_position_label === pos && r.metric === metric) || null;
  }
  function source(data, id) { return data.sources.find(s => s.id === id); }
  function avgDataset(data, id) { return data.recruit_average_datasets.find(d => d.id === id); }

  function bandText(row) {
    if (!row) return "";
    const u = row.unit === "seconds" ? " s" : " " + row.unit;
    const lo = row.published_lower, hi = row.published_upper;
    if (lo != null && hi != null) return lo === hi ? `${lo}${u}` : `${lo}–${hi}${u}`;
    if (lo != null) return `${lo}${u}+`;
    if (hi != null) return `${hi}${u} or faster`;
    return "Not published";
  }

  // Compare one value with one guideline row. Never penalizes exceeding a favorable boundary.
  function compareGuideline(row, value, why) {
    if (!row) return { status: S.NO_BENCH, reason: why || "The source publishes no target for this position group." };
    const base = {
      rowId: row.id, source: row.source_id, levelLabel: row.source_level_label, positionLabel: row.source_position_label,
      metric: row.metric, unit: row.unit, direction: row.direction, band: bandText(row), qualifier: row.qualifier,
      context: row.measurement_or_grouping, pooledGroup: row.same_source_pooled_group || null, kind: "guideline"
    };
    if (row.availability !== "published") return Object.assign(base, { status: S.NO_BENCH, reason: `Not published by the source (${row.measurement_or_grouping}).` });
    if (row.exclude_from_automatic_classification || row.provisional_comparison_threshold == null) {
      return Object.assign(base, { status: S.REF_ONLY, value: isNum(value) ? value : null, reason: row.review_note || "Shown as a source reference only; not used for automatic comparison." });
    }
    const t = row.provisional_comparison_threshold;
    if (!isNum(value)) return Object.assign(base, { status: S.NO_INPUT, threshold: t, reason: "You didn't enter this metric." });
    const higher = row.direction === "higher_is_better";
    const meets = higher ? value >= t - EPS : value <= t + EPS;
    const gap = meets ? 0 : round(higher ? t - value : value - t, row.unit === "seconds" ? 2 : 1);
    let note = "";
    if (higher && row.published_upper != null && value > row.published_upper) note = `Above the top of the published band (${row.published_upper} ${row.unit}). That's favorable, not a mismatch.`;
    if (!higher && row.published_lower != null && value < row.published_lower) note = `Faster than the fast end of the published band (${row.published_lower} s). That's favorable, not a mismatch.`;
    return Object.assign(base, { status: meets ? S.MEETS : S.BELOW, value, threshold: t, thresholdIsInterpretation: !!row.threshold_is_implementation_interpretation, gap, note });
  }

  // Compare with an observed sample mean. Never pass/fail.
  function compareMean(value, mean, unit, direction) {
    if (mean == null) return { status: S.NO_BENCH, reason: "No mean published for this group." };
    if (!isNum(value)) return { status: S.NO_INPUT, mean };
    const diff = round(value - mean, unit === "seconds" ? 2 : unit === "ratio" ? 3 : 1);
    const higher = direction === "higher_is_better";
    let status;
    if (Math.abs(diff) < EPS) status = "Equal to sample mean";
    else if (unit === "seconds" || unit === "runs / 9 innings" || unit === "(H+BB) / innings") {
      const better = higher ? diff > 0 : diff < 0;
      status = unit === "seconds" ? (diff < 0 ? "Faster than sample mean" : "Slower than sample mean") : (better ? "Better than sample mean" : "Worse than sample mean");
    } else status = diff > 0 ? "Above sample mean" : "Below sample mean";
    const favorable = Math.abs(diff) < EPS ? null : (higher ? diff > 0 : diff < 0);
    return { status, mean, value, diff, absDiff: Math.abs(diff), favorable, kind: "mean" };
  }

  // ---------- Reads ----------
  function readsFor(input) {
    const reads = [];
    const add = (pos) => { if (!pos) return; if (pos === "P") { if (!reads.some(r => r.kind === "pitching")) reads.push({ kind: "pitching", position: "P" }); } else reads.push({ kind: "position", position: pos }); };
    add(input.primary); add(input.secondary);
    return reads;
  }

  const THROW_INPUT = { infield: "ifVelo", outfield: "ofVelo", catcher: "cVelo" };
  const THROW_LABEL = { infield: "Infield throwing velocity", outfield: "Outfield throwing velocity", catcher: "Catcher throwing velocity" };

  function positionRead(data, input, pos) {
    const g = CFG.POSITION_GROUPS[pos];
    const m = input.metrics || {};
    const fam = g.family;
    const categories = CFG.CATEGORIES.map(cat => {
      const tools = {};
      tools.hitting = compareGuideline(targetRow(data, "NC", cat.nc, g.ncEv, "Exit velocity"), m.maxEv);
      tools.running = g.ncRun ? compareGuideline(targetRow(data, "NC", cat.nc, g.ncRun, "60-yard dash"), m.sixty)
        : compareGuideline(null, m.sixty, `NextCommit publishes no 60-yard target for ${pos === "1B" || pos === "3B" ? "corner infielders (1B/3B)" : pos}. Not borrowed from another position.`);
      if (fam === "C") tools.throwing = compareGuideline(targetRow(data, "NC", cat.nc, "C", "Pop time to 2B"), m.pop);
      else tools.throwing = compareGuideline(null, m[THROW_INPUT[g.throwTest]], "NextCommit publishes no throwing-velocity targets. See the separate NCSA reference.");
      // NCSA reference (separate guideline family; not part of the highlight rule)
      let nsRef;
      if (fam === "C") nsRef = { tool: "throwing", label: "Pop time to 2B", cmp: compareGuideline(targetRow(data, "NS", cat.ns, "C", "Pop time to 2B"), m.pop, "NCSA publishes no pop-time target for this group.") };
      else nsRef = { tool: "throwing", label: THROW_LABEL[g.throwTest], cmp: compareGuideline(g.nsThrow ? targetRow(data, "NS", cat.ns, g.nsThrow, "Throwing velocity") : null, m[THROW_INPUT[g.throwTest]], `NCSA publishes no throwing target for ${pos} in this group. Not borrowed from another position.`) };
      nsRef.sourceLevel = cat.ns;
      nsRef.pooledNote = cat.ns === "D1 (all)" ? "NCSA lists all of D1 as one group, so this can't separate the three D1 categories." : cat.ns === "D3 / NAIA" ? "NCSA combines D3 and NAIA." : "";

      const compared = Object.keys(tools).filter(k => tools[k].status === S.MEETS || tools[k].status === S.BELOW);
      const missing = Object.keys(tools).filter(k => !compared.includes(k)).map(k => ({ tool: k, status: tools[k].status, reason: tools[k].reason }));
      const R = CFG.HIGHLIGHT_RULE;
      const highlighted = compared.length >= R.minDistinctCoreTools && (!R.requireEveryComparedToolToMeet || compared.every(k => tools[k].status === S.MEETS));
      const pooled = compared.length > 0 && compared.every(k => tools[k].pooledGroup);
      return { key: cat.key, label: cat.label, ncLabel: cat.nc, tools, nsRef, compared, missing, highlighted, pooledGroup: pooled ? tools[compared[0]].pooledGroup : null };
    });
    return finishRead(data, input, { kind: "position", position: pos, family: fam, categories, toolKeys: ["hitting", "running", "throwing"] });
  }

  function pitchingRead(data, input) {
    const m = input.metrics || {};
    const hand = input.throws === "L" ? "LHP" : input.throws === "R" ? "RHP" : null;
    const useMax = isNum(m.maxFb);
    const value = useMax ? m.maxFb : (isNum(m.typFb) ? m.typFb : null);
    const basis = useMax ? "max fastball" : isNum(m.typFb) ? "typical game fastball" : null;
    const categories = CFG.CATEGORIES.map(cat => {
      const tools = { pitching: hand ? compareGuideline(targetRow(data, "NC", cat.nc, hand, "Fastball velocity"), value)
        : { status: S.NOT_COMP, reason: "Choose a throwing hand. Targets differ for right- and left-handed pitchers." } };
      const compared = tools.pitching.status === S.MEETS || tools.pitching.status === S.BELOW ? ["pitching"] : [];
      const missing = compared.length ? [] : [{ tool: "pitching", status: tools.pitching.status, reason: tools.pitching.reason }];
      return { key: cat.key, label: cat.label, ncLabel: cat.nc, tools, nsRef: null, compared, missing, highlighted: tools.pitching.status === S.MEETS, pooledGroup: null };
    });
    return finishRead(data, input, { kind: "pitching", position: "P", hand, basis, categories, toolKeys: ["pitching"] });
  }

  // ---------- Sample-mean panels (separate per source; never pooled together) ----------
  function bpPanel(data, input, read) {
    const ds = avgDataset(data, "BP"), m = input.metrics || {};
    const cols = [["Power 4", "Power 4"], ["Other D1", "Other D1 (pooled: mid-major + lower D1)"], ["D2", "D2"], ["D3", "D3"]];
    const env = (input.meta || {}).environment;
    const rows = [];
    const add = (metricName, value, unit, dir, label, opts) => {
      const rec = ds.records.find(r => r.metric === metricName); if (!rec) return;
      opts = opts || {};
      const row = { metric: rec.metric, label, unit: rec.unit, value: isNum(value) ? value : null, direction: dir, caveats: [] };
      if (opts.notComparable) { row.notComparable = opts.notComparable; row.cells = cols.map(([k, l]) => ({ col: l, mean: rec.means[k] })); rows.push(row); return; }
      row.cells = cols.map(([k, l]) => Object.assign({ col: l }, compareMean(value, rec.means[k], rec.unit, dir)));
      if (env && env !== "showcase") row.caveats.push("BaseballPath used best PBR showcase results; your metric is from a different setting.");
      if (opts.caveat) row.caveats.push(opts.caveat);
      rows.push(row);
    };
    if (read.kind === "pitching") {
      if (isNum(m.maxFb)) add("Pitcher top fastball", m.maxFb, "mph", "higher_is_better", "Top fastball (your max)");
      else add("Pitcher top fastball", null, "mph", "higher_is_better", "Top fastball", { notComparable: isNum(m.typFb) ? "BaseballPath reports top fastball; a typical game fastball is a different value." : "Enter a max fastball to compare." });
      add("Midpoint of best fastball range", null, "mph", "higher_is_better", "Midpoint of best fastball range", { notComparable: "A fastball-range midpoint is a different value from a top or typical fastball, and this form doesn't collect it." });
    } else {
      const g = CFG.POSITION_GROUPS[read.position];
      add(`Maximum exit velocity, ${g.bp}`, m.maxEv, "mph", "higher_is_better", `Max exit velocity (${g.bp})`);
      const runRec = ds.records.find(r => r.metric === `60-yard dash, ${g.bp}`);
      if (runRec) add(runRec.metric, m.sixty, "seconds", "lower_is_better", `60-yard dash (${g.bp})`, { caveat: (input.meta || {}).method === "hand" || (input.methods || {}).sixty === "hand" ? "Hand-timed. Timing methods aren't interchangeable; we don't adjust your time." : "" });
      else rows.push({ metric: "60-yard dash", label: "60-yard dash (C)", unit: "seconds", value: isNum(m.sixty) ? m.sixty : null, notComparable: "BaseballPath publishes no 60-yard mean for catchers.", cells: [], caveats: [] });
      if (g.throwTest === "outfield") add("Outfield throwing velocity", m.ofVelo, "mph", "higher_is_better", "Outfield throwing velocity");
      if (g.throwTest === "infield") add("Infield throwing velocity, pooled IF", m.ifVelo, "mph", "higher_is_better", "Infield throwing velocity (all infielders pooled)");
      if (g.throwTest === "catcher") { add("Catcher throwing velocity", m.cVelo, "mph", "higher_is_better", "Catcher throwing velocity"); add("Catcher best pop time", m.pop, "seconds", "lower_is_better", "Best pop time"); }
    }
    rows.forEach(r => r.caveats = r.caveats.filter(Boolean));
    return { id: "BP", title: "BaseballPath: committed players' best showcase results", kind: "Observed sample means", source: source(data, "BP"), population: ds.population, columns: cols.map(c => c[1]), rows };
  }

  function fgPanel(data, input, read) {
    if (read.kind !== "position" || read.family !== "OF") return null;
    const ds = avgDataset(data, "FG"), m = input.metrics || {};
    const defs = [["hit_exit_velocity_mph", "Max exit velocity", m.maxEv, "mph", "higher_is_better"], ["sixty_yard_seconds", "60-yard dash", m.sixty, "seconds", "lower_is_better"], ["outfield_arm_mph", "Outfield arm", m.ofVelo, "mph", "higher_is_better"]];
    const rows = defs.map(([k, label, v, unit, dir]) => ({ metric: k, label, unit, value: isNum(v) ? v : null, direction: dir, caveats: [],
      cells: ds.records.map(r => Object.assign({ col: r.source_tier }, compareMean(v, r[k], unit, dir))) }));
    return { id: "FG", title: "Flatground: outfielders during or after their junior season", kind: "Observed sample means", source: source(data, "FG"), population: ds.population, columns: ds.records.map(r => r.source_tier), rows,
      note: "These are the report's own tiers. Its Top 100 D1 group is not the same as Power conference D1, and its D1 tiers are not mapped onto our three D1 categories." };
  }

  function slPanel(data, input, read) {
    const ds = avgDataset(data, "SL"), m = input.metrics || {}, meta = input.meta || {};
    const cols = ["Power 4", "Mid-major D1", "D2", "D3", "JUCO / NAIA"];
    const colLabel = (c) => c === "JUCO / NAIA" ? "JUCO / NAIA (pooled)" : c;
    const rows = [];
    const add = (metricName, value, dir, label, opts) => {
      const rec = ds.records.find(r => r.metric === metricName); if (!rec) return;
      opts = opts || {};
      if (!isNum(value) && !opts.always) return;
      const row = { metric: rec.metric, label, unit: rec.unit, value: isNum(value) ? value : null, direction: dir, caveats: opts.caveats || [] };
      if (opts.notComparable) { row.notComparable = opts.notComparable; row.cells = cols.map(c => ({ col: colLabel(c), mean: rec.means[c] })); }
      else row.cells = cols.map(c => Object.assign({ col: colLabel(c) }, compareMean(value, rec.means[c], rec.unit, dir)));
      rows.push(row);
    };
    if (read.kind === "pitching") {
      const env = meta.environment;
      if (isNum(m.maxFb)) {
        if (env === "facility") add("Top facility fastball", m.maxFb, "higher_is_better", "Top facility fastball", { always: true, caveats: meta.method && meta.method !== "rapsodo" ? ["Slammers measured on Rapsodo; your device differs."] : [] });
        else if (!env) add("Top facility fastball", m.maxFb, "higher_is_better", "Top facility fastball", { always: true, caveats: ["Provisional: your testing environment is unknown, and Slammers used facility readings on Rapsodo."] });
        else add("Top facility fastball", m.maxFb, "higher_is_better", "Top facility fastball", { always: true, notComparable: `Slammers used top facility readings on Rapsodo. Your max is from a ${envLabel(env).toLowerCase()} setting, which is a different value.` });
      }
      add("ERA", m.era, "lower_is_better", "ERA", { caveats: ["Season, innings and opponents differ; context only."] });
      add("WHIP", m.whip, "lower_is_better", "WHIP", { caveats: ["Season, innings and opponents differ; context only."] });
      if (isNum(m.strikePct)) add("Pitcher strike rate", m.strikePct / 100, "higher_is_better", "Strike rate", { caveats: ["Strike rate, not zone rate. Provider rules may differ."] });
    } else {
      add("Maximum exit velocity", m.maxEv, "higher_is_better", "Max exit velocity (all hitters)");
      add("30-yard sprint", m.thirty, "lower_is_better", "30-yard sprint", { caveats: ["Compared only with the 30-yard test. Never converted to a 60."] });
      add("Batting average", m.avg, "higher_is_better", "Batting average", { caveats: ["Season and opponent context differ; denominators unpublished."] });
      add("On-base percentage", m.obp, "higher_is_better", "On-base percentage", { caveats: ["Season and opponent context differ; denominators unpublished."] });
      add("Slugging percentage", m.slg, "higher_is_better", "Slugging", { caveats: ["Season and opponent context differ; denominators unpublished."] });
    }
    if (!rows.length) return null;
    return { id: "SL", title: "Slammers: rising-senior summer cohort", kind: "Observed sample means", source: source(data, "SL"), population: ds.population, columns: cols.map(colLabel), rows,
      note: "JUCO and NAIA are one pooled group in this source, not two samples." };
  }

  function collegeContext(data, input, read) {
    if (read.kind !== "pitching") return null;
    const m = input.metrics || {}, pc = data.college_four_seam_average_dataset, sec = data.sec_research_sample;
    const hand = read.hand;
    const recs = pc.records.filter(r => !hand || r.hand === hand);
    return {
      title: "College pitchers' fastballs (context only)",
      kind: "College-player norms",
      warning: "These pitchers already play in college. They are not high school recruit averages and are never used to place you in a category.",
      source: source(data, "PC"), population: pc.population,
      value: isNum(m.typFb) ? m.typFb : null,
      valueNote: isNum(m.typFb) ? "Your typical game fastball, shown beside college game averages for context." : "Enter a typical game fastball to see it beside these college game averages. A max fastball is a different value.",
      rows: recs.map(r => ({ level: r.level, hand: r.hand, mean: r.mean_four_seam_mph, sample: r.sample_size, diff: isNum(m.typFb) ? round(m.typFb - r.mean_four_seam_mph, 1) : null })),
      sec: { source: source(data, "SEC"), text: `${sec.season} SEC sample: ${sec.pitchers} pitchers, ${sec.teams} teams, ${sec.pitches} four-seam fastballs, mean ${sec.mean_fastball_mph} mph (SD ${sec.fastball_sd_mph}). ${sec.scope}` }
    };
  }

  function envLabel(e) { return ({ game: "Game", showcase: "Showcase", bullpen: "Bullpen", facility: "Facility / training", tee: "Tee", front_toss: "Front toss", live_bp: "Live BP" })[e] || "Unknown"; }

  // ---------- Read summary: highlight, strengths, gaps ----------
  function finishRead(data, input, read) {
    const R = CFG.HIGHLIGHT_RULE;
    let hl = read.categories.filter(c => c.highlighted);
    const anyCompared = read.categories.some(c => c.compared.length);
    let headline, explain = [];
    if (read.kind === "pitching") {
      read.label = R.pitcherLabel;
      if (!hl.length) {
        headline = "More information needed for an overall range";
        if (!read.hand) explain.push("Choose a throwing hand: fastball targets differ for right- and left-handed pitchers.");
        else if (!anyCompared) explain.push("Enter a max or typical fastball to compare with the published velocity targets.");
        else explain.push("Your fastball is below every listed velocity target we could compare. That doesn't mean you can't play college baseball: velocity is one tool, and these are recruiting guidelines, not cutoffs.");
      } else {
        headline = "Fastball meets the listed target for: " + hl.map(c => c.label).join(", ");
        explain.push(`Based on your ${read.basis} only. NextCommit doesn't say whether its targets are top or sitting velocity, so this is provisional.`);
        explain.push("Repertoire, command, pitch quality and video still need evaluation. There are no published numeric targets for those.");
      }
    } else {
      if (!hl.length) {
        headline = "More information needed for an overall range";
        const maxCompared = Math.max(0, ...read.categories.map(c => c.compared.length));
        if (maxCompared < R.minDistinctCoreTools) explain.push(`An overall range needs at least ${R.minDistinctCoreTools} different core tools with published targets in the same category. You have ${maxCompared} at most.`);
        else explain.push("No category has every compared tool at or past its listed target. Your individual comparisons below still apply.");
        if (read.position === "1B" || read.position === "3B") explain.push("NextCommit publishes no 60-yard targets for corner infielders, so running can't count here.");
      } else {
        headline = "Compared tools meet the listed targets for: " + hl.map(c => c.label).join(", ");
      }
      const low = read.categories.find(c => c.key === "low");
      if (low && !low.compared.length) explain.push("Lower D1 can't be listed: NextCommit publishes no lower D1 targets for position players. That's a data gap, not a negative result.");
    }
    // NAIA/JUCO pooled rows: one piece of evidence, not two.
    const pooledPair = hl.filter(c => c.pooledGroup === "NAIA/JUCO");
    if (pooledPair.length === 2) explain.push("NAIA and JUCO share the same combined NextCommit targets for these tools, so they count as one piece of evidence, not two.");
    if (hl.length > 1) explain.push("The published targets can't separate these categories, so they are listed in a fixed order, not ranked. D2, D3, NAIA and JUCO overlap; they are not a strict ladder.");
    read.highlight = { categories: hl.map(c => c.key), headline, explain, hasRange: hl.length > 0 };

    // Strongest supported tools: the categories where each tool meets the listed target.
    read.strengths = read.toolKeys.map(k => {
      const met = read.categories.filter(c => c.tools[k] && c.tools[k].status === S.MEETS);
      const below = read.categories.filter(c => c.tools[k] && c.tools[k].status === S.BELOW);
      const bestD1 = met.map(c => CFG.CATEGORIES.find(x => x.key === c.key).d1Tier).filter(Boolean).sort()[0] || null;
      return { tool: k, met: met.map(c => c.key), below: below.map(c => c.key), bestD1 };
    }).filter(s => s.met.length || s.below.length)
      .sort((a, b) => (a.bestD1 || 9) - (b.bestD1 || 9));

    read.panels = [bpPanel(data, input, read), fgPanel(data, input, read), slPanel(data, input, read)].filter(Boolean);
    read.college = collegeContext(data, input, read);
    return read;
  }

  // Gaps to one chosen category's listed targets (never a promise of an offer).
  function gapsTo(read, catKey) {
    const c = read.categories.find(x => x.key === catKey); if (!c) return [];
    return read.toolKeys.map(k => {
      const t = c.tools[k];
      let text;
      if (t.status === S.MEETS) text = `Meets the listed ${t.band} target.`;
      else if (t.status === S.BELOW) text = t.unit === "seconds" ? `${t.gap.toFixed(2)} s faster would reach the listed ${t.threshold.toFixed(2)} s mark (${t.band}).` : `${t.gap} mph more would reach the listed ${t.threshold} mph mark (${t.band}).`;
      else if (t.status === S.NO_INPUT) text = `Not entered. Listed target: ${t.band}.`;
      else text = t.reason || t.status;
      return { tool: k, status: t.status, text };
    });
  }

  // ---------- Evidence and missing information ----------
  function gradeAt(gradYear, dateStr) {
    if (!isNum(gradYear) || !dateStr) return null;
    const y = parseInt(dateStr.slice(0, 4), 10), mo = parseInt(dateStr.slice(5, 7), 10);
    const schoolYearEnd = mo >= 7 ? y + 1 : y; // school year ending in spring
    return 12 - (gradYear - schoolYearEnd);
  }

  function evidence(input) {
    const meta = input.meta || {}, out = [];
    out.push({ key: "verified", text: "Verification: none. This tool doesn't verify metrics, so nothing here is marked verified." });
    if (meta.source === "self") out.push({ key: "source", text: "Self-reported metrics. That lowers evidence quality but doesn't change your metrics or the comparison." });
    else if (meta.source === "event") out.push({ key: "source", text: "From an event or showcase result." });
    else if (meta.source === "device") out.push({ key: "source", text: "From a device report (radar, sensor or timing system)." });
    else out.push({ key: "source", text: "Evidence source unknown. Treat the comparison as provisional." });
    if (meta.link) out.push({ key: "link", text: "Result link saved as a reference only. A link alone doesn't verify the metrics." });
    out.push({ key: "date", text: meta.date ? `Measured ${meta.date}.` : "Measurement date unknown. We can't check how current the metrics are or whether your class stage matches each source's cohort." });
    out.push({ key: "env", text: meta.environment ? `Testing environment: ${envLabel(meta.environment)}.` : "Testing environment unknown. Comparisons with sources that used a specific setting (showcase, facility) are provisional." });
    out.push({ key: "method", text: meta.method ? `Measurement method: ${methodLabel(meta.method)}.` + (meta.method === "hand" ? " Hand timing and electronic timing aren't interchangeable; times are not adjusted." : "") : "Measurement method unknown. Sources often don't state theirs either, so method-matched comparison isn't possible." });
    return out;
  }
  function methodLabel(k) { return ({ radar: "Radar gun", trackman: "TrackMan", rapsodo: "Rapsodo", sensor: "Bat or ball sensor", electronic: "Laser / electronic timing", hand: "Hand-held stopwatch" })[k] || "Unknown"; }

  function stageNotes(input) {
    const notes = [];
    const g = gradeAt(input.gradYear, (input.meta || {}).date);
    if (g == null) notes.push("We can't tell what grade you were in when measured (date unknown), so we can't check whether you match each source's cohort stage.");
    else {
      if (g < 11) notes.push(`You were in about grade ${g} when measured. The sample-mean cohorts were measured later (Flatground: during or after junior season; Slammers: rising-senior summer; BaseballPath: committed players' best results), so younger players often sit below them. We don't project future growth.`);
      else notes.push(`You were in about grade ${g > 12 ? "12 or beyond" : g} when measured.`);
    }
    return notes;
  }

  function missingInfo(input, reads) {
    const m = input.metrics || {}, out = [];
    reads.forEach(r => {
      if (r.kind === "pitching") {
        if (!isNum(m.maxFb)) out.push("Max fastball");
        if (!isNum(m.typFb)) out.push("Typical game fastball");
        if (!(m.repertoire || []).length) out.push("Pitch repertoire");
      } else {
        const g = CFG.POSITION_GROUPS[r.position];
        if (!isNum(m.maxEv)) out.push("Max exit velocity");
        if (!isNum(m.sixty)) out.push("60-yard dash");
        if (!isNum(m[THROW_INPUT[g.throwTest]])) out.push(THROW_LABEL[g.throwTest]);
        if (g.family === "C" && !isNum(m.pop)) out.push("Best pop time to second");
      }
    });
    return [...new Set(out)];
  }

  function evaluate(data, input) {
    const reads = readsFor(input).map(r => r.kind === "pitching" ? pitchingRead(data, input) : positionRead(data, input, r.position));
    return {
      dataVersion: data.schema_version, researchAsOf: data.research_as_of,
      reads, twoWay: reads.some(r => r.kind === "pitching") && reads.some(r => r.kind === "position"),
      evidence: evidence(input), stage: stageNotes(input), missing: missingInfo(input, reads),
      context: { heightIn: input.heightIn, weightLb: input.weightLb, note: "Height and weight are shown for context only. They don't change the comparison." },
      note: CFG.NOTE, interpretationNote: data.interpretation_note
    };
  }

  return { S, parseEntry, validate, evaluate, readsFor, positionRead, pitchingRead, compareGuideline, compareMean, targetRow, gapsTo, gradeAt, bandText, fmt, envLabel, methodLabel, CFG };
});
