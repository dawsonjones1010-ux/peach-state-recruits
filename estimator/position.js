/*
  Find My Level: position-player fit engine (v41). Pure functions, no DOM.
  Works in the browser (window.PSRPositionFit) and in Node (require) for tests.

  The level targets are the SAME published targets the estimator already uses (NextCommit, with the
  v1.2 fills from NextCommit's catcher page, TP, Uncommitted University, GoBig and NCSA; the few
  estimated ones are flagged). Nothing here invents a target. What this file adds is the scoring
  model from "Turning 100+ Baseball Metrics Into Find My Level":
    - a separate model per position (different category weights),
    - a 0–100 benchmark fit score for each of the seven levels,
    - category scores, a data confidence score, development priorities and a what-if.
  Scores are benchmark fit, NOT the chance of being recruited.

  Per-metric score: meeting a level's target exactly = 85 (the "strong fit" line). Each "step"
  better than the target adds 5 (three steps = 100). Each step short subtracts 10.
  One step = 1 mph for exit velocity and throws, 0.10 s for the 60, 0.05 s for pop time.
  Level fit = weighted category average × a weakest-tool gate (0.6 + 0.4 × weakest score / 100) over
  the tools the position leans on, because one core tool far below a level's line keeps you from
  reading as a clean fit there.
  Game stats (AVG/OBP/SLG) depend on competition, so they're shown, not scored.
  Physical projection isn't calculated (no growth forecasts). Height and weight never count.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRPositionFit = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = [
    { key: "p4",   label: "Power 4 / Elite D1", short: "Power 4" },
    { key: "mid",  label: "Mid-Major D1",       short: "Mid-Major D1" },
    { key: "low",  label: "Low-Major D1",       short: "Low-Major D1" },
    { key: "d2",   label: "Division II",        short: "D2" },
    { key: "d3",   label: "Division III",       short: "D3" },
    { key: "naia", label: "NAIA",               short: "NAIA" },
    { key: "juco", label: "JUCO",               short: "JUCO" }
  ];
  const ORDER = LEVELS.map(l => l.key);

  // Tool → dashboard category. Throwing is the defensive tool we can measure (pop time for catchers).
  const CAT = { hitting: "hitting", throwing: "defense", running: "speed" };
  const CAT_LABEL = { hitting: "Hitting tools", defense: "Defensive tools", speed: "Speed", performance: "Game performance", projection: "Physical projection" };

  // Weights per position (starting weights to test, not coaching standards). What each position is
  // known for: catchers by their arm and pop, 1B by the bat, middle infield and CF by speed and arm.
  const WEIGHTS = {
    C:    { hitting: 35, defense: 40, speed: 5,  performance: 15, projection: 5 },
    "1B": { hitting: 55, defense: 10, speed: 10, performance: 20, projection: 5 },
    "2B": { hitting: 30, defense: 25, speed: 25, performance: 15, projection: 5 },
    SS:   { hitting: 30, defense: 30, speed: 20, performance: 15, projection: 5 },
    "3B": { hitting: 40, defense: 30, speed: 10, performance: 15, projection: 5 },
    CF:   { hitting: 30, defense: 20, speed: 30, performance: 15, projection: 5 },
    LF:   { hitting: 45, defense: 15, speed: 20, performance: 15, projection: 5 },
    RF:   { hitting: 45, defense: 25, speed: 10, performance: 15, projection: 5 }
  };
  const FOCUS = {
    C: "Pop time, throwing velocity, receiving, exit velocity", "1B": "Exit velocity, offensive production, defensive reliability",
    "2B": "Speed, infield velocity, contact, defensive range", SS: "Infield velocity, 60-yard dash, range, exit velocity",
    "3B": "Arm strength, exit velocity, reaction, defensive ability", CF: "60-yard dash, outfield velocity, range, hitting",
    LF: "Exit velocity, outfield velocity, speed, offensive production", RF: "Exit velocity, outfield velocity, speed, offensive production"
  };

  const STEP = { mph: 1, seconds: 0.1 };
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stepFor = (t) => t.unit === "seconds" ? (/pop/i.test(t.metric || "") ? 0.05 : 0.1) : 1;

  function metricScore(t) {
    if (!t || !isNum(t.value) || !isNum(t.threshold)) return null;
    const higher = t.direction === "higher_is_better";
    const steps = (higher ? t.value - t.threshold : t.threshold - t.value) / stepFor(t);
    return Math.round(clamp(steps >= 0 ? 85 + 5 * steps : 85 + 10 * steps, 0, 100) * 10) / 10;
  }

  // read: a PSRLevel position read (categories[].tools[hitting|running|throwing] with threshold/value).
  function levelFit(read, cat) {
    const w = WEIGHTS[read.position] || WEIGHTS.SS;
    const tools = read.toolKeys.map(k => {
      const t = cat.tools[k];
      return { tool: k, cat: CAT[k], metric: t.metric, unit: t.unit, value: isNum(t.value) ? t.value : null, threshold: isNum(t.threshold) ? t.threshold : null,
        direction: t.direction, band: t.band, estimated: !!t.estimated, score: metricScore(t), meets: isNum(t.value) && isNum(t.threshold) ? t.status === "Meets listed target" : null };
    });
    const scored = tools.filter(t => t.score != null);
    const cats = { hitting: null, defense: null, speed: null, performance: null, projection: null };
    scored.forEach(t => { cats[t.cat] = t.score; });
    if (scored.length < 2) return { key: cat.key, tools, cats, score: null };
    const keys = Object.keys(cats).filter(k => cats[k] != null);
    const wsum = keys.reduce((a, k) => a + w[k], 0);
    const weighted = keys.reduce((a, k) => a + cats[k] * w[k], 0) / wsum;
    // The gate only looks at tools the position leans on (category weight 20+), so a first
    // baseman's 60 time can lower his score but can't cap it.
    const core = scored.filter(t => w[t.cat] >= 20);
    const weakest = Math.min(...(core.length ? core : scored).map(t => t.score));
    return { key: cat.key, tools, cats, score: Math.round(clamp(weighted * (0.6 + 0.4 * weakest / 100), 0, 99)) };
  }

  function confidence(input, read) {
    const meta = (input && input.meta) || {}, m = (input && input.metrics) || {}, methods = (input && input.methods) || {};
    const entered = read.toolKeys.filter(k => read.categories.some(c => isNum(c.tools[k].value))).length;
    const items = [];
    const add = (pts, have, label, fix) => items.push({ pts, have: !!have, label, fix });
    read.toolKeys.forEach(k => {
      const t = read.categories[0].tools[k];
      const name = k === "hitting" ? "max exit velocity" : k === "running" ? "60-yard dash" : read.family === "C" ? "pop time" : "throwing velocity";
      add(15, isNum(t.value), "Your " + name, "Add your " + name + ".");
    });
    add(10, isNum(m.avg) || isNum(m.obp) || isNum(m.slg), "Game stats (AVG, OBP or SLG)", "Add your season batting stats.");
    add(5, isNum(m.batSpeed) || isNum(m.avgEv), "Bat speed or average exit velocity", "Add bat speed or average exit velocity from a sensor.");
    add(15, meta.source === "event" || meta.source === "device", "Verified source (event or device report)", "Use numbers from a showcase or a device report, not self-reported.");
    const months = meta.date ? (Date.now() - new Date(meta.date + "T12:00:00").getTime()) / (30.44 * 864e5) : null;
    add(10, months != null && months <= 6, "Measured in the last 6 months", "Retest: measurements older than six months count for less.");
    const hasRun = read.toolKeys.includes("running") && read.categories.some(c => isNum(c.tools.running.value));
    add(5, !hasRun || methods.sixty === "laser", "Electronic (laser) 60 timing", "Get your 60 laser-timed. Hand times usually read faster than electronic ones.");
    add(5, !!methods.evDevice || !!methods.veloDevice || !!meta.method, "Measurement device known", "Tell us what device measured your numbers.");
    const total = items.reduce((a, i) => a + i.pts, 0), got = items.filter(i => i.have).reduce((a, i) => a + i.pts, 0);
    return { score: Math.round(got / total * 100), entered, have: items.filter(i => i.have).map(i => i.label), missing: items.filter(i => !i.have).map(i => i.fix) };
  }

  function priorities(lv, read) {
    if (!lv) return [];
    const out = [];
    lv.tools.forEach(t => {
      const name = t.tool === "hitting" ? "Max exit velocity" : t.tool === "running" ? "60-yard dash" : read.family === "C" ? "Pop time" : "Throwing velocity";
      if (t.value == null) { out.push({ tool: t.tool, label: name, current: "Not measured", goal: "Get a baseline", gap: 1 }); return; }
      if (t.meets !== false) return;
      const f = (v) => t.unit === "seconds" ? v.toFixed(2) + " s" : v + " mph";
      out.push({ tool: t.tool, label: name, current: f(t.value), goal: f(t.threshold) + (t.estimated ? " (estimated)" : ""), gap: Math.abs(t.value - t.threshold) / stepFor(t) });
    });
    return out.sort((a, b) => b.gap - a.gap);
  }

  const STRONG = 85, POSSIBLE = 70;
  function band(score) { return score == null ? "Needs more metrics" : score >= STRONG ? "Strong fit" : score >= POSSIBLE ? "Possible fit" : score >= 50 ? "Stretch" : "Long shot today"; }

  function evaluate(read, input) {
    const levels = read.categories.map(c => Object.assign({ label: LEVELS.find(l => l.key === c.key).label, short: LEVELS.find(l => l.key === c.key).short }, levelFit(read, c)));
    const conf = confidence(input || {}, read);
    if (!levels.some(l => l.score != null)) {
      return { enough: false, levels, confidence: conf, position: read.position,
        message: read.family === "C" ? "Enter at least two of your max exit velocity, pop time and 60-yard dash to get an evaluation." : "Enter at least two of your max exit velocity, 60-yard dash and throwing velocity to get an evaluation." };
    }
    const ladder = ORDER.slice(0, 6).map(k => levels.find(l => l.key === k)); // JUCO is a separate pathway, not a rung
    let primary = ladder.find(l => l.score != null && l.score >= STRONG) || ladder.filter(l => l.score != null).sort((a, b) => b.score - a.score)[0];
    const pi = ORDER.indexOf(primary.key);
    const stretch = pi > 0 ? levels.find(l => l.key === ORDER[pi - 1]) : null;
    const also = levels.filter(l => l.key !== primary.key && (!stretch || l.key !== stretch.key) && l.score != null && l.score >= POSSIBLE &&
      (l.key === "juco" || l.key === "naia" || ORDER.indexOf(l.key) === pi + 1)).map(l => l.key);
    const w = WEIGHTS[read.position] || WEIGHTS.SS;
    const m = (input && input.metrics) || {};
    const categories = ["hitting", "defense", "speed", "performance", "projection"].map(k => ({
      key: k, label: CAT_LABEL[k], weight: w[k], score: primary.cats[k] == null ? null : Math.round(primary.cats[k]),
      why: primary.cats[k] != null ? null
        : k === "performance" ? (isNum(m.avg) || isNum(m.obp) || isNum(m.slg) ? "Recorded. A .950 OPS against weak pitching isn't the same as against ranked teams, so stats aren't scored until they can be adjusted for competition." : "Add AVG, OBP and SLG. They're shown next to your tools; they aren't scored until they can be adjusted for competition.")
        : k === "projection" ? "This read doesn't forecast growth."
        : k === "speed" && !read.toolKeys.includes("running") ? "No 60-yard target for this position." : "Add this measurement to score it."
    }));
    return { enough: true, position: read.position, levels, primary: primary.key, primaryScore: primary.score,
      stretch: stretch ? stretch.key : null, also, categories, confidence: conf,
      priorities: priorities(stretch || primary, read), focus: FOCUS[read.position] || "" };
  }

  // What-if: re-score a read after patching tool values. Status thresholds stay the same.
  function withValues(read, patch) {
    const map = { hitting: "maxEv", running: "sixty", throwing: read.family === "C" ? "pop" : read.family === "OF" ? "ofVelo" : "ifVelo" };
    const copy = Object.assign({}, read, { categories: read.categories.map(c => {
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
    return copy;
  }

  return { LEVELS, WEIGHTS, CAT_LABEL, FOCUS, STRONG, POSSIBLE, metricScore, levelFit, confidence, priorities, evaluate, withValues, band,
    DISCLAIMER: "These scores show how your measurements line up with the published recruiting targets for your position at each level. They are not the chance of being recruited or getting an offer. Coaches also weigh game performance, defense, film, academics and roster needs." };
});
