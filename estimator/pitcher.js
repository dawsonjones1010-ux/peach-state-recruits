/*
  Find My Level: pitcher evaluation, scoring engine v3. Pure functions, no DOM.
  Browser: window.PSRPitcherFit (needs PSRFitCore). Node: require("./pitcher.js").

  Benchmarks: "Peach State Recruits: Pitcher Recruiting Standards by College Level" (owner-set
  screening ranges, Nov 2026). Not official NCAA standards or verified averages; ranges overlap on
  purpose. These values are unchanged from v40/v41 (tests/estimator.pitcher.test.js pins them).

  Scoring (all weights and adjustments live in fit-core.js CONFIG.pitcher):
    velocity  = sitting 75% + peak 25%, each scored against the level's range for the throwing hand
                (75 at the range minimum, 100 at the top, -12.5 per mph below the minimum).
                Peak only -> scored, but marked incomplete (sitting is never made up from peak).
    command   = strike % (25), BB/9 (25), K/BB (15), normalized over what's entered.
                First-pitch strike % (20) and zone % (15) have no benchmark: shown, not scored.
    performance = ERA, WHIP, K/9 (BB/9 and K/BB already count in command; no double counting).
    secondary pitches, pitch characteristics: descriptive only until pitch-shape benchmarks exist.
    base  = sum of category x level weight (normalized over scored categories)
    final = clamp(base - velocity shortfall adjustment, 0, 100); unrounded kept, display rounded.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./fit-core.js"));
  else root.PSRPitcherFit = factory(root.PSRFitCore);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";
  const CFG = C.CONFIG, isNum = C.isNum, clamp = C.clamp;

  const SOURCE = {
    name: "Peach State Recruits pitcher screening ranges",
    version: "1.0",
    asOf: "November 2026",
    note: "Screening ranges set by Peach State Recruits. Not official NCAA standards or verified averages. Ranges overlap on purpose, and individual schools recruit outside them."
  };

  const LEVELS = [
    { key: "p4",   label: "Power 4 / Elite D1", short: "Power 4" },
    { key: "mid",  label: "Mid-Major D1",       short: "Mid-Major D1" },
    { key: "low",  label: "Low-Major D1",       short: "Low-Major D1" },
    { key: "d2",   label: "Division II",        short: "D2" },
    { key: "d3",   label: "Division III",       short: "D3" },
    { key: "naia", label: "NAIA",               short: "NAIA" },
    { key: "juco", label: "JUCO",               short: "JUCO" }
  ];

  // Velocity (mph): [low edge, high edge]. A "+" on the source means the top is open-ended.
  const VELO = {
    R: {
      sit:  { p4: [90, 94], mid: [86, 91], low: [83, 88], d2: [80, 86], d3: [76, 84], naia: [77, 85], juco: [77, 90] },
      peak: { p4: [93, 97], mid: [89, 94], low: [86, 91], d2: [83, 89], d3: [79, 87], naia: [80, 88], juco: [80, 94] }
    },
    L: {
      sit:  { p4: [87, 92], mid: [84, 89], low: [81, 86], d2: [78, 84], d3: [74, 82], naia: [75, 83], juco: [75, 88] },
      peak: { p4: [90, 95], mid: [87, 92], low: [84, 89], d2: [81, 87], d3: [77, 85], naia: [78, 86], juco: [78, 92] }
    }
  };

  // Performance and command targets. dir "lower" = lower is better. null = "Varies" (JUCO): not scored.
  const PERF = {
    era:       { label: "ERA",      dir: "lower",  cat: "performance", t: { p4: 2.00, mid: 2.50, low: 3.00, d2: 3.25, d3: 3.75, naia: 3.75, juco: null }, fmt: v => v.toFixed(2) },
    whip:      { label: "WHIP",     dir: "lower",  cat: "performance", t: { p4: 1.00, mid: 1.10, low: 1.20, d2: 1.30, d3: 1.40, naia: 1.40, juco: null }, fmt: v => v.toFixed(2) },
    k9:        { label: "K/9",      dir: "higher", cat: "performance", t: { p4: 11, mid: 10, low: 9, d2: 8, d3: 7, naia: 7, juco: null }, fmt: v => v.toFixed(1) },
    bb9:       { label: "BB/9",     dir: "lower",  cat: "command",     t: { p4: 2.5, mid: 3.0, low: 3.5, d2: 4.0, d3: 4.5, naia: 4.5, juco: null }, fmt: v => v.toFixed(1) },
    strikePct: { label: "Strike %", dir: "higher", cat: "command",     t: { p4: 67, mid: 65, low: 63, d2: 62, d3: 60, naia: 60, juco: null }, fmt: v => Math.round(v * 10) / 10 + "%" },
    kbb:       { label: "K/BB",     dir: "higher", cat: "command",     t: { p4: 4.0, mid: 3.5, low: 3.0, d2: 2.5, d3: 2.0, naia: 2.0, juco: null }, fmt: v => v.toFixed(1) }
  };

  const SECONDARY = {
    p4:   { breaking: "At least one high-quality swing-and-miss offering", change: "Effective third pitch or clear development potential" },
    mid:  { breaking: "Reliable breaking ball with competitive velocity and movement", change: "Usable third pitch preferred" },
    low:  { breaking: "Consistent secondary pitch that can generate outs", change: "Developing third pitch acceptable" },
    d2:   { breaking: "At least one reliable secondary pitch", change: "Developing changeup acceptable" },
    d3:   { breaking: "Ability to throw a secondary pitch for strikes", change: "Development potential" },
    naia: { breaking: "Reliable secondary pitch, with expectations varying by program", change: "Development potential" },
    juco: { breaking: "Ranges from developmental pitches to elite swing-and-miss offerings", change: "Varies significantly by program" }
  };
  const PHYSICAL = {
    p4: "Present strength, efficient delivery, potential for additional velocity", mid: "Strength, repeatable mechanics, athletic development",
    low: "Projectable frame, movement quality, developing strength", d2: "Pitching ability, mechanics, development potential",
    d3: "Pitching ability, academic fit, development potential", naia: "Pitching ability, development potential, program fit",
    juco: "Present ability or significant development potential"
  };
  const PRIORITIES = {
    rows: ["Fastball velocity", "Fastball movement", "Command", "Secondary pitches", "Game performance", "Physical projection", "Academic fit"],
    p4:   ["Extremely high", "Very high", "Very high", "Very high", "High", "High", "Important"],
    mid:  ["Very high", "High", "Very high", "Very high", "High", "High", "Important"],
    low:  ["High", "High", "Very high", "High", "High", "Moderate–high", "Important"],
    d2:   ["High", "Moderate", "Very high", "High", "High", "Moderate", "Important"],
    d3:   ["Moderate–high", "Moderate", "Very high", "Moderate–high", "High", "Moderate", "Often important"],
    naia: ["Moderate–high", "Moderate", "Very high", "Moderate–high", "High", "Moderate", "Important"],
    juco: ["Varies", "Varies", "Very high", "Varies", "High", "High", "Important"]
  };
  const CAT_LABEL = { velocity: "Velocity", command: "Command", secondary: "Secondary pitches", characteristics: "Pitch characteristics", performance: "Game performance" };
  const PITCH_TYPES = ["Slider", "Curveball", "Sweeper", "Cutter", "Changeup", "Splitter", "Sinker", "Other"];

  // ---------- Metric scoring ----------
  function veloScore(v, range) {
    if (!isNum(v)) return null;
    const [lo, hi] = range;
    if (v >= hi) return 100;
    if (v >= lo) return 75 + 25 * (v - lo) / (hi - lo);
    return clamp(75 - 12.5 * (lo - v), 0, 75);
  }
  function targetScore(v, target, dir, key) {
    if (!isNum(v) || !isNum(target)) return null;
    const short = dir === "lower" ? v - target : target - v;
    if (short <= 1e-9) return 100;
    const step = CFG.pitcher.statSteps[key] || Math.abs(target) * 0.1;
    return clamp(100 - CFG.pitcher.statStepPoints * short / step, 0, 100);
  }
  const meets = (v, target, dir) => dir === "lower" ? v <= target : v >= target;
  function penaltyFor(gap) { return CFG.pitcher.velocityPenalty.find(p => gap > p.over).points; }

  // Box-score innings: 45.1 means 45 and one out (45.33), 45.2 means 45.67.
  function baseballInnings(ip) {
    if (!isNum(ip)) return null;
    const whole = Math.floor(ip), outs = Math.round((ip - whole) * 10);
    return outs === 1 || outs === 2 ? whole + outs / 3 : ip;
  }
  const r1 = (v) => Math.round(v * 10) / 10;
  function derive(m) {
    m = m || {};
    const out = { sit: isNum(m.typFb) ? m.typFb : null, peak: isNum(m.maxFb) ? m.maxFb : null,
      era: isNum(m.era) ? m.era : null, whip: isNum(m.whip) ? m.whip : null, strikePct: isNum(m.strikePct) ? m.strikePct : null,
      fpsPct: isNum(m.fpsPct) ? m.fpsPct : null, zonePct: isNum(m.zonePct) ? m.zonePct : null,
      k9: isNum(m.k9) ? m.k9 : null, bb9: isNum(m.bb9) ? m.bb9 : null, kbb: isNum(m.kbb) ? m.kbb : null, ip: isNum(m.ip) ? m.ip : null };
    const ip = baseballInnings(m.ip);
    if (ip && ip > 0) {                         // zero innings -> no rate (no divide by zero)
      if (out.k9 == null && isNum(m.so)) out.k9 = r1(m.so * 9 / ip);
      if (out.bb9 == null && isNum(m.bb)) out.bb9 = r1(m.bb * 9 / ip);
    }
    if (out.kbb == null) {
      if (isNum(m.so) && isNum(m.bb) && m.bb > 0) out.kbb = r1(m.so / m.bb);
      else if (isNum(out.k9) && isNum(out.bb9) && out.bb9 > 0) out.kbb = r1(out.k9 / out.bb9);
    }
    // K-BB% needs batters faced; shown only, never scored.
    if (isNum(m.so) && isNum(m.bb) && isNum(m.bf) && m.bf > 0) out.kbbPct = r1((m.so - m.bb) / m.bf * 100);
    return out;
  }

  // ---------- One level ----------
  function levelFit(key, hand, d) {
    const P = CFG.pitcher, vr = VELO[hand] || VELO.R, W = P.weights[key];
    const sitS = veloScore(d.sit, vr.sit[key]), peakS = veloScore(d.peak, vr.peak[key]);
    const veloRows = [];
    if (sitS != null) veloRows.push({ key: "sit", label: "Fastball sitting", value: d.sit, range: vr.sit[key], score: sitS });
    if (peakS != null) veloRows.push({ key: "peak", label: "Fastball peak", value: d.peak, range: vr.peak[key], score: peakS });
    let velocity = null, veloNote = null;
    if (sitS != null && peakS != null) velocity = sitS * P.velocitySplit.sitting + peakS * P.velocitySplit.peak;
    else if (sitS != null) { velocity = sitS; veloNote = "Sitting velocity only (no peak entered)."; }
    else if (peakS != null) { velocity = peakS; veloNote = "Incomplete: peak velocity only. Sitting velocity wasn't entered, and it's never estimated from your peak."; }

    const rows = (cat) => Object.keys(PERF).filter(k => PERF[k].cat === cat && isNum(d[k])).map(k => {
      const p = PERF[k], t = p.t[key];
      return { key: k, label: p.label, value: d[k], target: t, dir: p.dir, score: t == null ? null : targetScore(d[k], t, p.dir, k), meets: t == null ? null : meets(d[k], t, p.dir) };
    });
    const cmdRows = rows("command"), perfRows = rows("performance");
    const scoreMap = (rs) => Object.fromEntries(rs.filter(r => r.score != null).map(r => [r.key, r.score]));
    const cmdW = Object.fromEntries(Object.entries(P.command).filter(([k]) => !P.commandNoBenchmark.includes(k)));
    const command = C.weighted(scoreMap(cmdRows), cmdW), performance = C.weighted(scoreMap(perfRows), P.performance);
    const ipN = baseballInnings(d.ip), SS = P.smallSample;
    const sampleW = isNum(ipN) && ipN < SS.fullSampleIp ? Math.max(0, ipN) / SS.fullSampleIp : 1;
    const shrink = (v) => v == null ? null : sampleW * v + (1 - sampleW) * SS.neutralScore;
    const cats = { velocity, command: shrink(command.score), performance: shrink(performance.score), secondary: null, characteristics: null };
    const scorable = Object.fromEntries(Object.entries(W).filter(([k]) => k !== "provisional" && !P.notScored.includes(k)));
    const base = velocity == null ? { score: null, used: [] } : C.weighted(cats, scorable);
    const gap = isNum(d.sit) ? Math.max(0, vr.sit[key][0] - d.sit) : null;
    const penalty = gap == null ? 0 : penaltyFor(gap);
    const score = base.score == null ? null : clamp(base.score - penalty, 0, 100);
    const coreV = isNum(d.sit) ? d.sit : d.peak, coreMin = isNum(d.sit) ? vr.sit[key][0] : vr.peak[key][0];
    return {
      key, cats, veloRows, cmdRows, perfRows, veloNote, sampleWeight: sampleW, base: base.score, used: base.used, score,
      display: score == null ? null : Math.round(score),
      adjustments: penalty ? [{ label: `Velocity shortfall: sitting ${r1(gap)} mph below the ${vr.sit[key][0]} mph minimum`, points: -penalty }] : [],
      weights: W, provisional: !!W.provisional,
      coreOk: isNum(coreV) && coreV >= coreMin - P.coreWithinMph,
      plausible: isNum(coreV) && coreV >= coreMin - P.stretchWithinMph,
      hasGap: false // set after priorities
    };
  }

  // ---------- Descriptive data (never scored) ----------
  function secondaryPitches(m) {
    const out = [];
    [1, 2, 3].forEach(n => {
      const g = (f) => m["sp" + n + f];
      const type = m["sp" + n + "type"] || "";
      const fields = { avg: g("avg"), max: g("max"), spin: g("spin"), ivb: g("ivb"), hb: g("hb"), whiff: g("whiff"), usage: g("usage") };
      if (type || Object.values(fields).some(isNum)) out.push(Object.assign({ n, type: type || "Not specified" }, fields));
    });
    return out;
  }
  function characteristics(m) {
    return [["fbSpin", "Fastball spin", "rpm"], ["ivb", "Induced vertical break", "in"], ["hb", "Horizontal break", "in"], ["relHeight", "Release height", "ft"], ["extension", "Extension", "ft"], ["vaa", "Vertical approach angle", "°"]]
      .filter(([k]) => isNum(m[k])).map(([k, label, unit]) => ({ key: k, label, unit, value: m[k] }));
  }

  // ---------- Confidence ----------
  function confidence(input, d, info) {
    const m = (input && input.metrics) || {};
    // Completeness: essential items weigh more than optional advanced data.
    const items = [
      { w: 30, have: isNum(d.sit), label: "Sitting fastball", fix: "Add your sitting (typical game) fastball. It's the number coaches screen on." },
      { w: 15, have: isNum(d.peak), label: "Peak fastball", fix: "Add your peak fastball." },
      { w: 15, have: isNum(d.strikePct) || isNum(d.bb9), label: "Command (strike % or walks)", fix: "Add innings, strikeouts and walks, or your strike %." },
      { w: 10, have: isNum(d.era) || isNum(d.whip) || isNum(d.k9), label: "Game results (ERA, WHIP or K/9)", fix: "Add your season ERA, WHIP or strikeouts." },
      { w: 10, have: info.secondary.length > 0 || (m.repertoire || []).length > 1, label: "Secondary pitch information", fix: "Add your secondary pitches and their velocity." },
      { w: 10, have: isNum(d.ip), label: "Innings pitched", fix: "Add your season innings so stats can be weighed by sample size." },
      { w: 5, have: isNum(d.kbb), label: "Strikeout-to-walk ratio", fix: "Add season strikeouts and walks." },
      { w: 5, have: true, label: "Pitch tracking data (optional)", fix: "" } // optional: never counts against you
    ];
    const total = items.reduce((a, i) => a + i.w, 0);
    const completeness = items.filter(i => i.have).reduce((a, i) => a + i.w, 0) / total * 100;
    const ver = C.verificationValue(input);
    const rec = C.recencyValue(input && input.meta && input.meta.date);
    const smp = C.sampleValue("ip", isNum(d.ip) ? baseballInnings(d.ip) : null);
    if (isNum(d.ip)) smp.label = smp.label.replace(/\(.*IP\)/, `(${d.ip} IP)`);
    const idx = C.confidenceIndex({ completeness, verification: ver.value, recency: rec.value, sample: smp.value }, !isNum(d.sit));
    return Object.assign(idx, { notes: { completeness: `${Math.round(completeness)}% of the essential pitching data entered`, verification: ver.label, recency: rec.label, sample: smp.label },
      missing: items.filter(i => !i.have).map(i => i.fix) });
  }

  // ---------- Class context ----------
  // Senior year by the school calendar: from August, the current class is the one graduating next spring.
  function classContext(gradYear, now) {
    now = now || new Date();
    if (!isNum(gradYear)) return null;
    const seniorYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    const yearsLeft = gradYear - seniorYear;
    if (yearsLeft <= 0) return { yearsLeft, text: "This is your current fit. You're in your senior year or later, so today's numbers are what coaches are evaluating now." };
    if (yearsLeft === 1) return { yearsLeft, text: "This is your current fit as a junior. Graduation year never adds points; retest every few months to show progress." };
    return { yearsLeft, text: `This is your current fit, ${yearsLeft} years before graduation. Graduation year never adds points, and this read doesn't forecast growth. Use it as a starting line and retest every few months.` };
  }

  // ---------- Development recommendations (Phase 9) ----------
  function priorities(level, key, hand, d) {
    if (!level) return [];
    const out = [], vr = VELO[hand] || VELO.R, prec = CFG.precision;
    const rescore = (patch) => levelFit(key, hand, Object.assign({}, d, patch)).score;
    const add = (o) => {
      o.meaningful = o.gap > (o.precision || 0);
      o.impact = o.after != null && level.score != null ? Math.round((o.after - level.score) * 10) / 10 : null;
      out.push(o);
    };
    if (!isNum(d.sit)) out.push({ key: "sit", label: "Sitting fastball", current: "Not entered", target: `${vr.sit[key][0]}+ mph`, gap: null, gapText: "Not entered", core: true, importance: 100, impact: null, meaningful: true,
      why: "Sitting velocity is the first number coaches screen on, and your evaluation is incomplete without it.", action: "Get a game or bullpen reading of what you sit at, from a radar gun or TrackMan." });
    else if (d.sit < vr.sit[key][0]) { const t = vr.sit[key][0]; add({ key: "sit", label: "Sitting fastball", current: d.sit + " mph", target: t + " mph", gap: t - d.sit, gapText: `${r1(t - d.sit)} mph`, precision: prec.mph, core: true, importance: level.weights.velocity, after: rescore({ sit: t }),
      why: "Velocity carries the most weight, and sitting velocity counts three times as much as your peak.", action: "Build sustained velocity, then retest your sitting speed under the same conditions." }); }
    if (isNum(d.peak) && d.peak < vr.peak[key][0]) { const t = vr.peak[key][0]; add({ key: "peak", label: "Peak fastball", current: d.peak + " mph", target: t + " mph", gap: t - d.peak, gapText: `${r1(t - d.peak)} mph`, precision: prec.mph, core: true, importance: level.weights.velocity / 3, after: rescore({ peak: t }),
      why: "Peak velocity shows your ceiling; it's a quarter of the velocity score.", action: "Retest peak velocity at your next bullpen or showcase." }); }
    level.cmdRows.concat(level.perfRows).forEach(r => {
      if (r.meets !== false) return;
      const p = PERF[r.key], gap = Math.abs(r.value - r.target);
      add({ key: r.key, label: p.label, current: p.fmt(r.value), target: (p.dir === "lower" ? "under " : "") + p.fmt(r.target) + (p.dir === "higher" ? "+" : ""), gap, gapText: p.fmt(gap).replace("%", " pts"), precision: prec[r.key] || 0, core: p.cat === "command", importance: level.weights[p.cat], after: rescore({ [r.key]: r.target }),
        why: p.cat === "command" ? "Command matters at every level, and it carries more weight at D2, D3 and NAIA." : "Game results back up your tools, but they count less than velocity and command.",
        action: p.cat === "command" ? "Track strikes and walks every outing so you can show steady command." : "Keep logging full-season stats against the best competition you can find." });
    });
    // Rank: core tools first, then score impact at this level, then importance. Never smallest-gap-first.
    out.sort((a, b) => (b.core - a.core) || ((b.impact || 0) - (a.impact || 0)) || (b.importance - a.importance));
    return out;
  }

  // ---------- Standout tools (Phase 7): only above an existing benchmark; never bonus points ----------
  function standouts(d, hand) {
    const vr = VELO[hand] || VELO.R, out = [];
    if (isNum(d.sit) && d.sit >= vr.sit.p4[0]) out.push({ tool: "Fastball Velocity", detail: `Sits ${d.sit} mph, inside the Power 4 sitting range (${vr.sit.p4[0]}+ mph for a ${hand === "L" ? "lefty" : "righty"}).` });
    else if (!isNum(d.sit) && isNum(d.peak) && d.peak >= vr.peak.p4[0]) out.push({ tool: "Fastball Velocity (peak)", detail: `Peaks at ${d.peak} mph, inside the Power 4 peak range (${vr.peak.p4[0]}+ mph). Add your sitting velocity to confirm it.` });
    if (isNum(d.strikePct) && isNum(d.bb9) && meets(d.strikePct, PERF.strikePct.t.p4, "higher") && meets(d.bb9, PERF.bb9.t.p4, "lower")) out.push({ tool: "Strong Command", detail: `${PERF.strikePct.fmt(d.strikePct)} strikes and ${PERF.bb9.fmt(d.bb9)} BB/9 meet the Power 4 command targets (67%+ and 2.5 or lower).` });
    if (isNum(d.k9) && d.k9 >= PERF.k9.t.p4) out.push({ tool: "High Strikeout Ability", detail: `${PERF.k9.fmt(d.k9)} K/9 meets the Power 4 target (11+). Strikeout rates depend on competition.` });
    return out;
  }

  // ---------- Main ----------
  function evaluate(input, extra) {
    input = input || {};
    const m = Object.assign({}, input.metrics || {});
    extra = extra || {};
    // v40/v41 fields stay supported: a single breaking ball / changeup velocity becomes a pitch row.
    const bbV = isNum(extra.bbVelo) ? extra.bbVelo : m.bbVelo, chV = isNum(extra.chVelo) ? extra.chVelo : m.chVelo;
    if ((isNum(bbV) || m.bbType || isNum(m.bbSpin) || isNum(m.bbWhiff)) && !m.sp1type) Object.assign(m, { sp1type: m.bbType || "Breaking ball", sp1avg: bbV, sp1spin: m.bbSpin, sp1whiff: m.bbWhiff });
    if ((isNum(chV) || isNum(m.chWhiff)) && !m.sp2type) Object.assign(m, { sp2type: "Changeup", sp2avg: chV, sp2whiff: m.chWhiff });
    const hand = input.throws === "L" ? "L" : "R";
    const d = derive(m);
    const info = { secondary: secondaryPitches(m), characteristics: characteristics(m), fpsPct: d.fpsPct, zonePct: d.zonePct, kbbPct: d.kbbPct };
    const levels = LEVELS.map(l => Object.assign({ label: l.label, short: l.short }, levelFit(l.key, hand, d)));
    levels.forEach(l => { l.classification = C.classify(l.score); });
    const conf = confidence(input, d, info);
    const enough = levels.some(l => l.score != null);
    if (!enough) return { model: C.MODEL_VERSION, enough: false, hand, derived: d, levels, confidence: conf, info, standouts: [], source: SOURCE, also: [], ties: [],
      message: "Enter your fastball velocity (sitting, peak or both) to get a pitcher evaluation." };
    levels.forEach(l => { l.priorities = priorities(l, l.key, hand, d); l.hasGap = l.priorities.some(p => p.meaningful && p.gap != null); });
    const sel = C.selectTargets(levels, { sufficient: true });
    const anchorKey = sel.primary || sel.closest;
    const anchor = levels.find(l => l.key === anchorKey);
    const focusKey = sel.stretch || anchorKey;
    const focus = levels.find(l => l.key === focusKey);
    const categories = ["velocity", "command", "secondary", "characteristics", "performance"].map(k => ({
      key: k, label: CAT_LABEL[k], weight: anchor.weights[k],
      score: anchor.cats[k] == null ? null : Math.round(anchor.cats[k]),
      scored: !CFG.pitcher.notScored.includes(k),
      why: anchor.cats[k] != null ? (k === "velocity" ? anchor.veloNote : null)
        : k === "characteristics" ? (info.characteristics.length ? "Recorded below, not scored. Spin and break only mean something next to pitch type, velocity, arm slot and release, so they aren't graded against one number." : "Optional. Missing TrackMan or Rapsodo data never lowers your score.")
        : k === "secondary" ? (info.secondary.length ? "Recorded below, not scored. Breaking balls and changeups are judged on video and pitch shape; there's no reliable pitch-quality benchmark yet." : "Not entered. Your secondary pitches are shown, not scored, until pitch-shape benchmarks exist.")
        : k === "command" ? "Add strike %, or innings with strikeouts and walks, to score command."
        : (anchor.key === "juco" ? "JUCO performance targets vary by program, so stats aren't scored there." : "Add ERA, WHIP or strikeouts to score game performance.")
    }));
    return {
      model: C.MODEL_VERSION, enough: true, hand, derived: d, levels, info,
      primary: sel.primary, closest: sel.closest, provisional: conf.label === "Insufficient", stretch: sel.stretch, stretchReason: sel.stretchReason, also: sel.also, ties: sel.ties,
      primaryScore: anchor.display, categories, confidence: conf,
      priorities: (focus ? focus.priorities : []).slice(0, 3), focusLevel: focusKey,
      standouts: standouts(d, hand), classContext: classContext(input.gradYear), source: SOURCE,
      secondaryNotes: { expect: SECONDARY[anchor.key], expectStretch: sel.stretch ? SECONDARY[sel.stretch] : null }
    };
  }

  function label(key) { const l = LEVELS.find(x => x.key === key); return l ? l.label : key; }
  return { SOURCE, LEVELS, VELO, PERF, SECONDARY, PHYSICAL, PRIORITIES, CAT_LABEL, PITCH_TYPES,
    veloScore, targetScore, penaltyFor, derive, baseballInnings, levelFit, confidence, classContext, priorities, standouts, evaluate, label, band: C.classify,
    DISCLAIMER: "These scores show how your numbers line up with Peach State Recruits' screening ranges for each level. They are not the chance of being recruited or getting an offer. Coaches also weigh video, pitch quality, competition, academics and roster needs." };
});
