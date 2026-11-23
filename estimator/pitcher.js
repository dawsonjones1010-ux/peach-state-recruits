/*
  Find My Level: pitcher fit engine (v40). Pure functions, no DOM.
  Works in the browser (window.PSRPitcherFit) and in Node (require) for tests.

  Source of every number below: "Peach State Recruits: Pitcher Recruiting Standards by College
  Level" (owner-set screening ranges, Nov 2026). These are practical screening ranges set by
  Peach State Recruits. They are NOT official NCAA standards, NOT verified averages across every
  program, and NOT offer probabilities. Ranges overlap on purpose. JUCO varies widely.

  Scoring model (starting weights to test, not coaching standards):
    Velocity 40 · Command 20 · Secondary pitches 15 · Pitch characteristics 10 · Game performance 10 · Projection 5
  (v41, owner direction: coaches screen on fastball velocity before anything else, so velocity
  carries the most weight and also gates the whole score.)
  Pitch characteristics and secondary pitches have no numeric screening line (they depend on pitch
  shape, arm slot and video), and projection is not calculated (no growth forecasts). Those three
  are shown as "Not scored" and their weight is spread over the scored categories. The data
  confidence score tells the player how much of the evaluation is actually backed by entered data.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRPitcherFit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

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

  // Performance targets. dir "lower" = lower is better. null = "Varies" on the source (JUCO): not scored.
  const PERF = {
    era:       { label: "ERA",           dir: "lower",  cat: "performance", t: { p4: 2.00, mid: 2.50, low: 3.00, d2: 3.25, d3: 3.75, naia: 3.75, juco: null }, fmt: v => v.toFixed(2) },
    whip:      { label: "WHIP",          dir: "lower",  cat: "performance", t: { p4: 1.00, mid: 1.10, low: 1.20, d2: 1.30, d3: 1.40, naia: 1.40, juco: null }, fmt: v => v.toFixed(2) },
    k9:        { label: "K/9",           dir: "higher", cat: "performance", t: { p4: 11, mid: 10, low: 9, d2: 8, d3: 7, naia: 7, juco: null }, fmt: v => v.toFixed(1) },
    bb9:       { label: "BB/9",          dir: "lower",  cat: "command",     t: { p4: 2.5, mid: 3.0, low: 3.5, d2: 4.0, d3: 4.5, naia: 4.5, juco: null }, fmt: v => v.toFixed(1) },
    strikePct: { label: "Strike %",      dir: "higher", cat: "command",     t: { p4: 67, mid: 65, low: 63, d2: 62, d3: 60, naia: 60, juco: null }, fmt: v => Math.round(v * 10) / 10 + "%" },
    kbb:       { label: "K/BB",          dir: "higher", cat: "command",     t: { p4: 4.0, mid: 3.5, low: 3.0, d2: 2.5, d3: 2.0, naia: 2.0, juco: null }, fmt: v => v.toFixed(1) }
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
    p4: "Present strength, efficient delivery, potential for additional velocity",
    mid: "Strength, repeatable mechanics, athletic development",
    low: "Projectable frame, movement quality, developing strength",
    d2: "Pitching ability, mechanics, development potential",
    d3: "Pitching ability, academic fit, development potential",
    naia: "Pitching ability, development potential, program fit",
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

  const WEIGHTS = { velocity: 40, pitchShape: 10, secondary: 15, command: 20, performance: 10, projection: 5 };
  const CAT_LABEL = { velocity: "Velocity", pitchShape: "Fastball characteristics", secondary: "Secondary pitches", command: "Command", performance: "Game performance", projection: "Projection" };

  const isNum = (v) => typeof v === "number" && isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---------- Metric scoring ----------
  // Velocity against a level range: at/above the top edge = 100; inside the range = 75–100;
  // each mph below the bottom edge costs 12.5 points (6 mph below = 0).
  function veloScore(v, range) {
    if (!isNum(v)) return null;
    const [lo, hi] = range;
    if (v >= hi) return 100;
    if (v >= lo) return 75 + 25 * (v - lo) / (hi - lo);
    return clamp(75 - 12.5 * (lo - v), 0, 75);
  }
  // A performance target: meeting it = 100; each 1% short of the target costs 4 points.
  function targetScore(v, target, dir) {
    if (!isNum(v) || !isNum(target)) return null;
    if (dir === "lower") {
      if (v <= target) return 100;
      return clamp(100 - 400 * ((v - target) / target), 0, 100);
    }
    if (v >= target) return 100;
    return clamp(100 - 400 * ((target - v) / target), 0, 100);
  }
  const meets = (v, target, dir) => dir === "lower" ? v <= target : v >= target;

  // ---------- Input → derived pitching numbers ----------
  // m: { typFb, maxFb, era, whip, strikePct, ip, so, bb, k9, bb9, bbVelo, chVelo, fbSpin, ivb, extension, repertoire }
  function derive(m) {
    m = m || {};
    const out = { sit: isNum(m.typFb) ? m.typFb : null, peak: isNum(m.maxFb) ? m.maxFb : null,
      era: isNum(m.era) ? m.era : null, whip: isNum(m.whip) ? m.whip : null, strikePct: isNum(m.strikePct) ? m.strikePct : null,
      k9: isNum(m.k9) ? m.k9 : null, bb9: isNum(m.bb9) ? m.bb9 : null, kbb: null, ip: isNum(m.ip) ? m.ip : null };
    const ip = isNum(m.ip) ? baseballInnings(m.ip) : null;
    if (ip && ip > 0) {
      if (out.k9 == null && isNum(m.so)) out.k9 = r1(m.so * 9 / ip);
      if (out.bb9 == null && isNum(m.bb)) out.bb9 = r1(m.bb * 9 / ip);
    }
    if (isNum(m.so) && isNum(m.bb) && m.bb > 0) out.kbb = r1(m.so / m.bb);
    else if (isNum(out.k9) && isNum(out.bb9) && out.bb9 > 0) out.kbb = r1(out.k9 / out.bb9);
    return out;
  }
  // Box-score innings: 45.1 means 45 and one out (45.33), 45.2 means 45.67.
  function baseballInnings(ip) {
    const whole = Math.floor(ip), outs = Math.round((ip - whole) * 10);
    return outs === 1 || outs === 2 ? whole + outs / 3 : ip;
  }

  // ---------- One level ----------
  function levelFit(key, hand, d) {
    const velo = [], cmd = [], perf = [];
    const vr = VELO[hand] || VELO.R;
    const sitS = veloScore(d.sit, vr.sit[key]), peakS = veloScore(d.peak, vr.peak[key]);
    if (sitS != null) velo.push({ key: "sit", label: "Fastball sitting", value: d.sit, range: vr.sit[key], score: sitS, weight: 0.6 });
    if (peakS != null) velo.push({ key: "peak", label: "Fastball peak", value: d.peak, range: vr.peak[key], score: peakS, weight: 0.4 });
    Object.keys(PERF).forEach(k => {
      const p = PERF[k], t = p.t[key], v = d[k];
      if (!isNum(v)) return;
      const row = { key: k, label: p.label, value: v, target: t, dir: p.dir, score: t == null ? null : targetScore(v, t, p.dir), meets: t == null ? null : meets(v, t, p.dir) };
      (p.cat === "command" ? cmd : perf).push(row);
    });
    const avg = (rows) => { const s = rows.filter(r => r.score != null); if (!s.length) return null; const w = s.reduce((a, r) => a + (r.weight || 1), 0); return s.reduce((a, r) => a + r.score * (r.weight || 1), 0) / w; };
    const cats = { velocity: avg(velo), command: avg(cmd), performance: avg(perf), pitchShape: null, secondary: null, projection: null };
    const scored = Object.keys(cats).filter(k => cats[k] != null);
    if (cats.velocity == null) return { key, cats, velo, cmd, perf, score: null };
    const wsum = scored.reduce((a, k) => a + WEIGHTS[k], 0);
    const weighted = scored.reduce((a, k) => a + cats[k] * WEIGHTS[k], 0) / wsum;
    // Velocity gate: a level's fit can't outrun the fastball. Coaches screen on velocity first,
    // so great stats with a fastball well below a level's range still read as a stretch there.
    const gate = 0.25 + 0.75 * (cats.velocity / 100);
    const score = Math.round(clamp(weighted * gate, 0, 99));
    return { key, cats, velo, cmd, perf, score };
  }

  // ---------- Confidence (completeness, verification, recency) ----------
  function confidence(input, d, extra) {
    const meta = (input && input.meta) || {}, m = (input && input.metrics) || {};
    const items = [];
    const add = (pts, have, label, fix) => items.push({ pts, have: !!have, label, fix });
    add(15, isNum(d.peak), "Peak fastball", "Enter your peak fastball.");
    add(15, isNum(d.sit), "Sitting (typical game) fastball", "Add your typical game fastball, not just your peak.");
    add(10, isNum(d.bb9) || isNum(d.strikePct), "Command numbers (walks or strike %)", "Add innings, strikeouts and walks, or your strike %.");
    add(5, isNum(d.kbb), "Strikeout-to-walk ratio", "Add season strikeouts and walks.");
    add(10, isNum(d.era) || isNum(d.whip) || isNum(d.k9), "Game results (ERA, WHIP or K/9)", "Add your season ERA, WHIP or strikeouts.");
    add(10, (m.repertoire || []).length > 1 || isNum(extra.bbVelo) || isNum(extra.chVelo), "Secondary pitch information", "Add your secondary pitches and their velocity.");
    add(5, isNum(m.fbSpin) || isNum(m.ivb), "Fastball movement data", "Add TrackMan or Rapsodo spin and IVB if you have it.");
    const src = meta.source;
    add(15, src === "event" || src === "device", "Verified source (event or device report)", "Use numbers from a showcase or a device report, not self-reported.");
    const months = meta.date ? (Date.now() - new Date(meta.date + "T12:00:00").getTime()) / (30.44 * 864e5) : null;
    add(10, months != null && months <= 6, "Measured in the last 6 months", "Retest: measurements older than six months count for less.");
    add(5, !!meta.method || !!(input.methods && input.methods.veloDevice), "Measurement method known", "Tell us what device measured your velocity.");
    const ipOk = isNum(d.ip) && baseballInnings(d.ip) >= 20;
    if (isNum(d.ip)) items.push({ pts: 0, have: ipOk, label: "Enough innings for stats to mean much (20+)", fix: "Season stats over fewer than 20 innings are a small sample.", note: true });
    const total = items.reduce((a, i) => a + i.pts, 0), got = items.filter(i => i.have).reduce((a, i) => a + i.pts, 0);
    let score = Math.round(got / total * 100);
    if (isNum(d.ip) && !ipOk) score = Math.max(0, score - 5);
    return { score, have: items.filter(i => i.have).map(i => i.label), missing: items.filter(i => !i.have && i.fix).map(i => i.fix), items };
  }

  // ---------- Class-year context (current vs projected) ----------
  function classContext(gradYear, now) {
    now = now || new Date();
    if (!isNum(gradYear)) return null;
    const seniorYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear(); // Aug+ belongs to next spring's class
    const yearsLeft = gradYear - seniorYear;
    if (yearsLeft <= 0) return { yearsLeft, text: "This is your current fit. You're in your senior year or later, so today's numbers are what coaches are evaluating now." };
    if (yearsLeft === 1) return { yearsLeft, text: "This is your current fit as a junior. Many pitchers still add velocity before college; this read doesn't project that. Retest every few months." };
    return { yearsLeft, text: `This is your current fit, ${yearsLeft} years before graduation. A Class of ${gradYear} pitcher shouldn't be judged like a senior with the same numbers. Use this as a starting line and retest every few months; this read doesn't forecast growth.` };
  }

  // ---------- Development priorities toward a stretch level ----------
  function priorities(fit, stretchKey, d, hand, secondaryMeasured) {
    const lv = fit.levels.find(l => l.key === stretchKey);
    if (!lv) return [];
    const out = [];
    const vr = (VELO[hand] || VELO.R);
    if (isNum(d.sit)) {
      const [lo, hi] = vr.sit[stretchKey], goal = Math.ceil((lo + hi) / 2);
      if (d.sit < goal) out.push({ key: "sit", label: "Fastball sitting velocity", current: d.sit + " mph", goal: goal + " mph", gap: (goal - d.sit) / goal });
    } else if (isNum(d.peak)) {
      const [lo, hi] = vr.peak[stretchKey], goal = Math.ceil((lo + hi) / 2);
      if (d.peak < goal) out.push({ key: "peak", label: "Peak fastball velocity", current: d.peak + " mph", goal: goal + " mph", gap: (goal - d.peak) / goal });
    }
    lv.cmd.concat(lv.perf).forEach(r => {
      if (r.meets !== false) return;
      const p = PERF[r.key];
      out.push({ key: r.key, label: p.label, current: p.fmt(r.value), goal: (p.dir === "lower" ? "Below " : "") + p.fmt(r.target) + (p.dir === "higher" ? "+" : ""), gap: Math.abs(r.value - r.target) / r.target });
    });
    out.sort((a, b) => b.gap - a.gap);
    if (!secondaryMeasured) out.push({ key: "secondary", label: "Secondary pitch data", current: "Not measured", goal: "Establish a baseline (velocity and movement)", gap: 0 });
    const vIdx = out.findIndex(o => o.key === "sit" || o.key === "peak");
    if (vIdx > 0) out.unshift(out.splice(vIdx, 1)[0]); // velocity is the first screen, so it leads
    return out;
  }

  const STRONG = 85, POSSIBLE = 70;
  const TIER_ORDER = ["p4", "mid", "low", "d2", "d3", "naia", "juco"];

  // ---------- Main ----------
  // input: the estimator input object ({ throws, gradYear, metrics, meta, methods }).
  // extra: { bbVelo, chVelo } secondary pitch velocities (recorded; not scored).
  function evaluate(input, extra) {
    extra = extra || {};
    const m = (input && input.metrics) || {};
    const hand = input && input.throws === "L" ? "L" : "R";
    const d = derive(Object.assign({}, m, extra));
    const levels = LEVELS.map(l => Object.assign({ label: l.label, short: l.short }, levelFit(l.key, hand, d)));
    const enough = levels.some(l => l.score != null);
    const conf = confidence(input || {}, d, extra);
    if (!enough) return { enough: false, hand, derived: d, levels, confidence: conf, message: "Enter your fastball velocity (peak, sitting or both) to get a pitcher evaluation.", source: SOURCE };
    // Category scores shown on the dashboard: measured against the primary target level.
    const ladder = TIER_ORDER.slice(0, 6).map(k => levels.find(l => l.key === k)); // JUCO is a separate pathway, not a rung
    let primary = ladder.find(l => l.score != null && l.score >= STRONG) || null;
    if (!primary) primary = ladder.filter(l => l.score != null).sort((a, b) => b.score - a.score)[0];
    const juco = levels.find(l => l.key === "juco");
    const pi = TIER_ORDER.indexOf(primary.key);
    const stretch = pi > 0 ? levels.find(l => l.key === TIER_ORDER[pi - 1]) : null;
    // Realistic neighbors: the next rung down, NAIA (it runs alongside D2/D3), and JUCO (its own pathway).
    // The rung above is the stretch target, so it isn't repeated here.
    const also = levels.filter(l => l.key !== primary.key && (!stretch || l.key !== stretch.key) && l.score != null && l.score >= POSSIBLE &&
      (l.key === "juco" || l.key === "naia" || TIER_ORDER.indexOf(l.key) === pi + 1));
    const catScores = ["velocity", "pitchShape", "secondary", "command", "performance", "projection"].map(k => ({
      key: k, label: CAT_LABEL[k], weight: WEIGHTS[k],
      score: primary.cats[k] == null ? null : Math.round(primary.cats[k]),
      why: primary.cats[k] != null ? null :
        k === "pitchShape" ? (isNum(m.fbSpin) || isNum(m.ivb) ? "Recorded. Spin and break only mean something next to pitch type, velocity, arm slot and release, so they aren't scored against a single number." : "Add TrackMan or Rapsodo data. It's read next to your pitch type and arm slot, never as one cutoff.")
        : k === "secondary" ? "Breaking balls and changeups are judged on video and movement, and there's no single numeric line for them yet."
        : k === "projection" ? "This read doesn't forecast growth."
        : k === "command" ? "Add walks or strike % to score command."
        : "Add ERA, WHIP or strikeouts to score game performance."
    }));
    const prio = priorities({ levels }, stretch ? stretch.key : primary.key, d, hand, isNum(extra.bbVelo) || isNum(extra.chVelo) || isNum(m.bbSpin));
    return {
      enough: true, hand, derived: d, levels, primary: primary.key, primaryScore: primary.score,
      stretch: stretch ? stretch.key : null, also: also.map(l => l.key), juco: juco.score,
      categories: catScores, priorities: prio, confidence: conf,
      classContext: classContext(input && input.gradYear), source: SOURCE,
      secondaryNotes: { bbVelo: isNum(extra.bbVelo) ? extra.bbVelo : null, chVelo: isNum(extra.chVelo) ? extra.chVelo : null, repertoire: m.repertoire || [], expect: SECONDARY[primary.key], expectStretch: stretch ? SECONDARY[stretch.key] : null }
    };
  }

  function label(key) { const l = LEVELS.find(x => x.key === key); return l ? l.label : key; }
  function band(score) { return score == null ? "Not enough data" : score >= STRONG ? "Strong fit" : score >= POSSIBLE ? "Possible fit" : score >= 50 ? "Stretch" : "Long shot today"; }

  return { SOURCE, LEVELS, VELO, PERF, SECONDARY, PHYSICAL, PRIORITIES, WEIGHTS, CAT_LABEL, STRONG, POSSIBLE,
    veloScore, targetScore, derive, baseballInnings, levelFit, confidence, classContext, priorities, evaluate, label, band,
    DISCLAIMER: "These scores show how your numbers line up with Peach State Recruits' screening ranges for each level. They are not the chance of being recruited or getting an offer. Coaches also weigh video, pitch quality, competition, academics and roster needs." };
});
