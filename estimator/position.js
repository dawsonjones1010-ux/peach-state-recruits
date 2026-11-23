/*
  Find My Level: position-player evaluation, scoring engine v3. Pure functions, no DOM.
  Browser: window.PSRPositionFit (needs PSRFitCore). Node: require("./position.js").

  The level targets are the SAME published targets the estimator already uses (NextCommit, with the
  v1.2 fills from NextCommit's catcher page, TP, Uncommitted University, GoBig and NCSA; the few
  estimated ones are flagged). Nothing here invents a target.

  v3 scoring (weights in fit-core.js CONFIG.position):
    - A separate model per position: hitting / defense / speed / game performance weights.
    - Inside a category, only metrics with a published benchmark are scored: max exit velocity
      (hitting), throwing velocity or pop time (defense), 60-yard dash (speed). Everything else the
      player enters (bat speed, average EV, game stats) is shown, and the category is labeled a
      "limited assessment".
    - Per-metric score: meeting a level's target = 85. Each step better adds 5 (cap 100); each step
      short subtracts 10. One step = 1 mph, 0.10 s for the 60, 0.05 s for pop time.
    - Level fit = weighted average over the categories that could be scored. The v41 weakest-tool
      multiplier is gone; instead a level can only be the primary target when every core tool
      (category weight 20+) scores at least CONFIG.position.coreMin.
    - Game stats depend on competition, so they never change the score; plate appearances only
      affect confidence. Height and weight never count.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./fit-core.js"));
  else root.PSRPositionFit = factory(root.PSRFitCore);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";
  const CFG = C.CONFIG, PC = C.CONFIG.position, isNum = C.isNum, clamp = C.clamp;

  const LEVELS = [
    { key: "p4",   label: "Power 4 / Elite D1", short: "Power 4" },
    { key: "mid",  label: "Mid-Major D1",       short: "Mid-Major D1" },
    { key: "low",  label: "Low-Major D1",       short: "Low-Major D1" },
    { key: "d2",   label: "Division II",        short: "D2" },
    { key: "d3",   label: "Division III",       short: "D3" },
    { key: "naia", label: "NAIA",               short: "NAIA" },
    { key: "juco", label: "JUCO",               short: "JUCO" }
  ];

  const CAT = { hitting: "hitting", throwing: "defense", running: "speed" };
  const CAT_LABEL = { hitting: "Hitting tools", defense: "Defensive tools", speed: "Speed", performance: "Game performance" };
  const WEIGHTS = PC.weights;
  const FOCUS = {
    C: "Pop time, throwing velocity, receiving, exit velocity", "1B": "Exit velocity, offensive production, defensive reliability",
    "2B": "Speed, infield velocity, contact, defensive range", SS: "Infield velocity, 60-yard dash, range, exit velocity",
    "3B": "Arm strength, exit velocity, reaction, defensive ability", CF: "60-yard dash, outfield velocity, range, hitting",
    LF: "Exit velocity, outfield velocity, speed, offensive production", RF: "Exit velocity, outfield velocity, speed, offensive production"
  };
  // Metrics we collect per category that have no published level benchmark yet (shown, not scored).
  const UNSCORED = {
    hitting: ["Bat speed", "Average exit velocity", "90th-percentile exit velocity", "Hard-hit %"],
    defense: ["Glove work, footwork, range and receiving (judged on video)"],
    speed: ["10-yard split", "Home to first", "Sprint speed"]
  };

  const stepFor = (t) => t.unit === "seconds" ? (/pop/i.test(t.metric || "") ? 0.05 : 0.1) : 1;
  const toolName = (k, read) => k === "hitting" ? "Max exit velocity" : k === "running" ? "60-yard dash" : read.family === "C" ? "Pop time" : read.family === "OF" ? "Outfield throwing velocity" : "Infield throwing velocity";

  function metricScore(t) {
    if (!t || !isNum(t.value) || !isNum(t.threshold)) return null;
    const higher = t.direction === "higher_is_better";
    const steps = (higher ? t.value - t.threshold : t.threshold - t.value) / stepFor(t);
    return Math.round(clamp(steps >= 0 ? PC.targetScore + PC.stepUp * steps : PC.targetScore + PC.stepDown * steps, 0, 100) * 10) / 10;
  }

  function scoreTools(tools, w) {
    const scored = tools.filter(t => t.score != null);
    const cats = { hitting: null, defense: null, speed: null, performance: null };
    scored.forEach(t => { cats[t.cat] = t.score; });
    if (scored.length < PC.minTools) return { cats, score: null, used: [] };
    const res = C.weighted(cats, { hitting: w.hitting, defense: w.defense, speed: w.speed });
    return { cats, score: res.score, used: res.used };
  }

  // read: a PSRLevel position read (categories[].tools[hitting|running|throwing] with threshold/value).
  function levelFit(read, cat) {
    const w = WEIGHTS[read.position] || WEIGHTS.SS;
    const tools = read.toolKeys.map(k => {
      const t = cat.tools[k];
      return { tool: k, label: toolName(k, read), cat: CAT[k], metric: t.metric, unit: t.unit, value: isNum(t.value) ? t.value : null, threshold: isNum(t.threshold) ? t.threshold : null,
        direction: t.direction, band: t.band, estimated: !!t.estimated, core: w[CAT[k]] >= 20, score: metricScore(t),
        meets: isNum(t.value) && isNum(t.threshold) ? t.status === "Meets listed target" : null };
    });
    const s = scoreTools(tools, w);
    const scored = tools.filter(t => t.score != null);
    const core = scored.filter(t => t.core);
    const missingCore = tools.filter(t => t.core && t.value == null && t.threshold != null);
    return { key: cat.key, tools, cats: s.cats, used: s.used, weights: w, score: s.score, display: s.score == null ? null : Math.round(s.score), adjustments: [],
      coreOk: core.length > 0 && missingCore.length === 0 && core.every(t => t.score >= PC.coreMin),
      plausible: scored.every(t => t.score >= PC.stretchMin), hasGap: scored.some(t => t.meets === false),
      provisional: cat.key === "juco" };
  }

  // ---------- Hitting stats (Phase 4): shown and used for confidence only ----------
  function hittingStats(m) {
    m = m || {};
    const out = { avg: m.avg, obp: m.obp, slg: m.slg, pa: isNum(m.pa) ? m.pa : null, competition: m.competition || null };
    if (isNum(m.obp) && isNum(m.slg)) out.ops = Math.round((m.obp + m.slg) * 1000) / 1000;
    if (isNum(m.slg) && isNum(m.avg)) out.iso = Math.round((m.slg - m.avg) * 1000) / 1000;
    if (isNum(m.pa) && m.pa > 0) {
      if (isNum(m.hk)) out.kPct = Math.round(m.hk / m.pa * 1000) / 10;
      if (isNum(m.hbb)) out.bbPct = Math.round(m.hbb / m.pa * 1000) / 10;
    }
    out.sample = C.sampleValue("pa", out.pa);
    out.any = [m.avg, m.obp, m.slg, m.pa].some(isNum);
    return out;
  }

  function confidence(input, read) {
    const m = (input && input.metrics) || {}, methods = (input && input.methods) || {};
    const w = WEIGHTS[read.position] || WEIGHTS.SS;
    const items = [];
    read.toolKeys.forEach(k => {
      const t = read.categories[0].tools[k];
      const has = read.categories.some(c => isNum(c.tools[k].value));
      const benchmarked = read.categories.some(c => isNum(c.tools[k].threshold));
      if (!benchmarked) return; // no target anywhere: never counts against the player
      items.push({ w: w[CAT[k]] >= 20 ? 30 : 15, have: has, core: w[CAT[k]] >= 20, label: toolName(k, read), fix: "Add your " + toolName(k, read).toLowerCase() + "." });
    });
    items.push({ w: 10, have: isNum(m.avg) || isNum(m.obp) || isNum(m.slg), label: "Season batting stats", fix: "Add your season AVG, OBP and SLG." });
    items.push({ w: 10, have: isNum(m.pa), label: "Plate appearances", fix: "Add your plate appearances so stats can be weighed by sample size." });
    const total = items.reduce((a, i) => a + i.w, 0);
    const completeness = items.filter(i => i.have).reduce((a, i) => a + i.w, 0) / total * 100;
    const hand = read.toolKeys.includes("running") && isNum(m.sixty) && methods.sixty && methods.sixty !== "laser";
    const ver = C.verificationValue(input, { handTimed: hand });
    const rec = C.recencyValue(input && input.meta && input.meta.date);
    const smp = C.sampleValue("pa", isNum(m.pa) ? m.pa : null);
    const incomplete = items.some(i => i.core && !i.have);
    const idx = C.confidenceIndex({ completeness, verification: ver.value, recency: rec.value, sample: smp.value }, incomplete);
    if (hand) items.push({ have: false, fix: "Get your 60 laser-timed. Hand times usually read faster than electronic ones." });
    return Object.assign(idx, { notes: { completeness: `${Math.round(completeness)}% of the essential data for a ${read.position} entered`, verification: ver.label, recency: rec.label, sample: smp.label },
      missing: items.filter(i => !i.have).map(i => i.fix) });
  }

  // ---------- Development recommendations (Phase 9) ----------
  function priorities(lv, read) {
    if (!lv) return [];
    const out = [], w = lv.weights;
    const prec = { mph: CFG.precision.mph, sixty: CFG.precision.sixty, pop: CFG.precision.pop };
    lv.tools.forEach(t => {
      if (t.threshold == null) return;
      const f = (v) => t.unit === "seconds" ? v.toFixed(2) + " s" : v + " mph";
      if (t.value == null) {
        if (t.core) out.push({ tool: t.tool, label: t.label, current: "Not measured", target: f(t.threshold), gapText: "Not measured", gap: null, core: true, impact: null, importance: w[t.cat], meaningful: true,
          why: `This is a core tool for a ${read.position}, so the evaluation is incomplete without it.`, action: "Get a baseline at your next showcase, camp or training session." });
        return;
      }
      if (t.meets !== false) return;
      const patched = lv.tools.map(x => x === t ? Object.assign({}, x, { score: PC.targetScore }) : x);
      const after = scoreTools(patched, w).score;
      const gap = Math.abs(t.value - t.threshold);
      const p = t.unit === "seconds" ? (/pop/i.test(t.metric || "") ? prec.pop : prec.sixty) : prec.mph;
      out.push({ tool: t.tool, label: t.label, current: f(t.value), target: f(t.threshold) + (t.estimated ? " (estimated)" : ""), gap, gapText: t.unit === "seconds" ? gap.toFixed(2) + " s" : Math.round(gap * 10) / 10 + " mph",
        core: t.core, importance: w[t.cat], impact: lv.score != null && after != null ? Math.round((after - lv.score) * 10) / 10 : null, meaningful: gap > p,
        why: t.core ? `One of the tools coaches lean on most for a ${read.position}.` : `It counts for less at ${read.position}, but it's still part of the read.`,
        action: t.tool === "hitting" ? "Train bat speed and strength, then retest exit velocity off a tee or front toss with the same device."
          : t.tool === "running" ? "Work on acceleration and top speed, then retest the 60 on laser timing."
          : read.family === "C" ? "Drill footwork and transfer, then retest pop time on the same timing setup." : "Build arm strength with a throwing program, then retest on radar." });
    });
    // Rank: core first, then score impact, then position importance. Not by smallest gap.
    out.sort((a, b) => (b.core - a.core) || ((b.impact || 0) - (a.impact || 0)) || (b.importance - a.importance));
    return out;
  }

  // ---------- Standout tools (Phase 7): at or beyond the Power 4 published target; never bonus points ----------
  function standouts(levels, read) {
    const p4 = levels.find(l => l.key === "p4");
    if (!p4) return [];
    const names = { hitting: "Exceptional Exit Velocity", running: "Elite Speed", throwing: read.family === "C" ? "Elite Pop Time" : "Plus Arm Strength" };
    return p4.tools.filter(t => t.value != null && t.threshold != null && t.meets === true).map(t => ({
      tool: names[t.tool], detail: `${t.unit === "seconds" ? t.value.toFixed(2) + " s" : t.value + " mph"} meets the Power 4 target for a ${read.position} (${t.unit === "seconds" ? t.threshold.toFixed(2) + " s" : t.threshold + " mph"}).`
    }));
  }

  function band(score) { return C.classify(score); }

  function evaluate(read, input) {
    input = input || {};
    const levels = read.categories.map(c => { const L = LEVELS.find(l => l.key === c.key); return Object.assign({ label: L.label, short: L.short }, levelFit(read, c)); });
    levels.forEach(l => { l.classification = C.classify(l.score); });
    const conf = confidence(input, read);
    const stats = hittingStats(input.metrics);
    if (!levels.some(l => l.score != null)) {
      return { model: C.MODEL_VERSION, enough: false, levels, confidence: conf, position: read.position, stats, also: [], ties: [], standouts: [],
        message: read.family === "C" ? "Enter at least two of your max exit velocity, pop time and 60-yard dash to get an evaluation." : "Enter at least two of your max exit velocity, 60-yard dash and throwing velocity to get an evaluation." };
    }
    levels.forEach(l => { l.priorities = priorities(l, read); });
    const sel = C.selectTargets(levels, { sufficient: true });
    const anchor = levels.find(l => l.key === (sel.primary || sel.closest));
    const focusKey = sel.stretch || anchor.key;
    const focus = levels.find(l => l.key === focusKey);
    const w = WEIGHTS[read.position] || WEIGHTS.SS;
    const categories = ["hitting", "defense", "speed", "performance"].map(k => ({
      key: k, label: CAT_LABEL[k], weight: w[k], score: anchor.cats[k] == null ? null : Math.round(anchor.cats[k]),
      limited: k !== "performance",
      unscored: UNSCORED[k] || [],
      why: anchor.cats[k] != null ? null
        : k === "performance" ? (stats.any ? "Recorded below. A .950 OPS against weak pitching isn't the same as against ranked teams, so stats don't change the score; plate appearances only affect confidence." : "Add AVG, OBP, SLG and plate appearances. They're shown next to your tools and affect confidence, not the score.")
        : k === "speed" && !read.toolKeys.includes("running") ? "No published 60-yard target for this position, so speed isn't scored." : "Add this measurement to score it."
    }));
    return { model: C.MODEL_VERSION, enough: true, position: read.position, levels, stats,
      primary: sel.primary, closest: sel.closest, provisional: conf.label === "Insufficient", primaryScore: anchor.display, stretch: sel.stretch, stretchReason: sel.stretchReason, also: sel.also, ties: sel.ties,
      categories, confidence: conf, priorities: (focus ? focus.priorities : []).slice(0, 3), focusLevel: focusKey,
      standouts: standouts(levels, read), focus: FOCUS[read.position] || "" };
  }

  // What-if: re-score a read after patching tool values. Status thresholds stay the same.
  function withValues(read, patch) {
    const map = { hitting: "maxEv", running: "sixty", throwing: read.family === "C" ? "pop" : read.family === "OF" ? "ofVelo" : "ifVelo" };
    return Object.assign({}, read, { categories: read.categories.map(c => {
      const tools = {};
      Object.keys(c.tools).forEach(k => {
        const t = Object.assign({}, c.tools[k]), key = map[k];
        if (key in patch && isNum(t.threshold)) {
          t.value = isNum(patch[key]) ? patch[key] : null;
          if (t.value == null) t.status = "Not entered";
          else t.status = (t.direction === "higher_is_better" ? t.value >= t.threshold - 1e-9 : t.value <= t.threshold + 1e-9) ? "Meets listed target" : "Below listed target";
        }
        tools[k] = t;
      });
      return Object.assign({}, c, { tools });
    }) });
  }

  return { LEVELS, WEIGHTS, CAT_LABEL, FOCUS, UNSCORED, metricScore, levelFit, hittingStats, confidence, priorities, standouts, evaluate, withValues, band,
    DISCLAIMER: "These scores show how your measurements line up with the published recruiting targets for your position at each level. They are not the chance of being recruited or getting an offer. Coaches also weigh game performance, defense, film, academics and roster needs." };
});
