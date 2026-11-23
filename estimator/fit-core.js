/*
  Find My Level: scoring engine v3, shared core (configuration + helpers). Pure, no DOM.
  Browser: window.PSRFitCore. Node: require("./fit-core.js").

  EVERY tunable number in the v3 scoring engine lives in CONFIG below. None of these values is a
  published recruiting benchmark or a coaching standard: they are Peach State Recruits' provisional
  product settings (weights, penalties, labels, confidence values) and are labeled that way in the UI.
  Published benchmarks stay where they were (data/level-benchmarks-*.json and the pitcher screening
  ranges in pitcher.js) and are never changed here.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRFitCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MODEL_VERSION = "3.2.0";

  const CONFIG = {
    // ---- Pitchers (Phase 1) ----
    pitcher: {
      // Category weights per level (v44, owner decision): fastball velocity is 60% of the score at
      // the three D1 levels and 50% everywhere else. Command and game performance split the rest in
      // the same proportions as the v3 spec. Secondary pitches and pitch characteristics have no
      // pitch-shape benchmark yet, so they're shown and weighted 0 until one exists.
      weights: {
        p4:   { velocity: 60, command: 30, performance: 10, secondary: 0, characteristics: 0 },
        mid:  { velocity: 60, command: 27, performance: 13, secondary: 0, characteristics: 0 },
        low:  { velocity: 60, command: 28, performance: 12, secondary: 0, characteristics: 0 },
        d2:   { velocity: 50, command: 37, performance: 13, secondary: 0, characteristics: 0 },
        d3:   { velocity: 50, command: 33, performance: 17, secondary: 0, characteristics: 0 },
        naia: { velocity: 50, command: 31, performance: 19, secondary: 0, characteristics: 0 },
        juco: { velocity: 50, command: 29, performance: 21, secondary: 0, characteristics: 0, provisional: true }
      },
      notScored: ["secondary", "characteristics"],
      velocitySplit: { sitting: 0.75, peak: 0.25 },
      // Share of the command score. First-pitch strike % and zone % have no published benchmark,
      // so they are shown as supporting information and excluded (weights renormalize).
      command: { strikePct: 25, fpsPct: 20, bb9: 25, kbb: 15, zonePct: 15 },
      commandNoBenchmark: ["fpsPct", "zonePct"],
      // Game performance uses ERA, WHIP and K/9 only. BB/9 and K/BB already count in command.
      performance: { era: 1, whip: 1, k9: 1 },
      // Velocity shortfall adjustment (points), from sitting velocity vs the level's sitting minimum.
      velocityPenalty: [ { over: 5, points: 18 }, { over: 3, points: 12 }, { over: 2, points: 7 }, { over: 1, points: 3 }, { over: -Infinity, points: 0 } ],
      // Command and performance stats: meeting a target = 100; each "step" short costs statStepPoints.
      // (v42.0 used -4 points per 1% short, which zeroed out a 2.0 K/BB against a 3.5 target and let
      // ratio stats outweigh a Power 4-range fastball.) Steps are about one meaningful season difference.
      statSteps: { strikePct: 2, bb9: 0.5, kbb: 0.5, era: 0.5, whip: 0.1, k9: 1 },
      statStepPoints: 10,
      // Small samples: under fullSampleIp innings, command and performance scores are blended toward
      // neutralScore in proportion to innings (10 IP = half weight), so a few outings can't swing a level.
      // Innings not entered: stats count at face value and confidence shows the missing sample.
      smallSample: { fullSampleIp: 20, neutralScore: 85 },
      // "Core benchmarks reasonably satisfied" for a primary target: sitting (or peak, if that's all
      // we have) within this many mph of the level's minimum.
      coreWithinMph: 2,
      // A stretch level is "plausible" when the fastball is within this many mph of its minimum.
      stretchWithinMph: 5
    },

    // ---- Position players (Phase 2) ----
    position: {
      weights: {
        // v45 (owner decision): each position's core tools carry 50-70% of the score.
        C:    { hitting: 30, defense: 55, speed: 5,  performance: 10 },
        "1B": { hitting: 70, defense: 15, speed: 5,  performance: 10 },
        "2B": { hitting: 35, defense: 25, speed: 30, performance: 10 },
        SS:   { hitting: 25, defense: 45, speed: 20, performance: 10 },
        "3B": { hitting: 55, defense: 30, speed: 5,  performance: 10 },
        CF:   { hitting: 30, defense: 25, speed: 35, performance: 10 },
        LF:   { hitting: 60, defense: 20, speed: 10, performance: 10 },
        RF:   { hitting: 55, defense: 30, speed: 5,  performance: 10 }
      },
      // Inside each category, only metrics with a published benchmark are scored. The others are
      // collected and shown, and the category is labeled "limited assessment".
      hitting: { maxEv: 35, ev90: 25, avgEv: 15, batSpeed: 15, hardHitPct: 10 },
      speed: { sixty: 60, tenYd: 20, homeToFirst: 15, sprintSpeed: 5 },
      // Per-metric score: meeting the target = targetScore; each step better adds stepUp (cap 100),
      // each step short subtracts stepDown. Steps: 1 mph, 0.10 s (60), 0.05 s (pop time).
      targetScore: 85, stepUp: 5, stepDown: 10,
      // A core tool (category weight 20+) must score at least this for a level to be a primary target.
      coreMin: 75,
      // Every scored tool must score at least this for a level to be a plausible stretch.
      stretchMin: 50,
      minTools: 2
    },

    // ---- Level selection (Phase 3) ----
    selection: {
      primaryMin: 85,
      stretchMin: 65,
      additionalMin: 80,
      ladder: ["p4", "mid", "low", "d2", "d3", "naia"], // navigation order only, not a strict talent ladder
      separate: ["juco"]
    },
    classifications: [
      { min: 90, label: "Strong benchmark fit" },
      { min: 80, label: "Competitive benchmark fit" },
      { min: 70, label: "Developing benchmark fit" },
      { min: 60, label: "Below typical benchmark fit" },
      { min: -Infinity, label: "Significant benchmark gaps" }
    ],

    // ---- Confidence (Phase 8) ----
    confidence: {
      weights: { completeness: 0.30, verification: 0.30, recency: 0.20, sample: 0.20 },
      verification: { verified: 100, documented: 85, selfElectronic: 70, selfHand: 50, unspecified: 30 },
      recency: [ { maxDays: 90, value: 100 }, { maxDays: 180, value: 85 }, { maxDays: 365, value: 65 }, { maxDays: Infinity, value: 35 } ],
      recencyUnknown: 35,
      // Plate appearances (spec) and innings pitched (PSR provisional) → sample value.
      paBands: [ { min: 150, label: "Stronger sample", value: 100 }, { min: 75, label: "Moderate", value: 75 }, { min: 30, label: "Limited", value: 50 }, { min: 0, label: "Insufficient", value: 20 } ],
      ipBands: [ { min: 50, label: "Stronger sample", value: 100 }, { min: 25, label: "Moderate", value: 75 }, { min: 10, label: "Limited", value: 50 }, { min: 0, label: "Insufficient", value: 20 } ],
      labels: [ { min: 85, label: "High" }, { min: 65, label: "Moderate" }, { min: 40, label: "Limited" }, { min: -Infinity, label: "Insufficient" } ],
      // When essential data is incomplete (e.g. no sitting velocity), confidence can't exceed this.
      incompleteCap: 64
    },

    // ---- Development (Phase 6/9) ----
    precision: { mph: 1, sixty: 0.05, pop: 0.03, strikePct: 1, bb9: 0.2, kbb: 0.2, era: 0.1, whip: 0.05, k9: 0.3 },
    outlook: { minDaysBetween: 30 }
  };

  const isNum = (v) => typeof v === "number" && isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function classify(score) {
    if (!isNum(score)) return "Incomplete evaluation";
    return CONFIG.classifications.find(c => Math.round(score) >= c.min).label;
  }
  function confidenceLabel(score) { return CONFIG.confidence.labels.find(c => score >= c.min).label; }

  // Weighted average over the keys that have a number. Returns { score, used: [{key, weight, score}] }.
  function weighted(parts, weights) {
    const used = Object.keys(weights).filter(k => isNum(parts[k])).map(k => ({ key: k, weight: weights[k], score: parts[k] }));
    const w = used.reduce((a, u) => a + u.weight, 0);
    if (!w) return { score: null, used: [] };
    used.forEach(u => { u.share = u.weight / w; });
    return { score: used.reduce((a, u) => a + u.score * u.share, 0), used };
  }

  // ---------- Confidence ----------
  const ELECTRONIC = new Set(["radar", "trackman", "rapsodo", "sensor", "electronic", "laser", "gun", "pocket", "stadium", "hittrax", "blast"]);
  // Verification needs evidence: "event" or "device" counts as verified third-party only with a
  // result link; without one it's treated like a documented measurement.
  function verificationValue(input, opts) {
    const V = CONFIG.confidence.verification, meta = (input && input.meta) || {}, methods = (input && input.methods) || {};
    if (meta.source === "event" || meta.source === "device") return { value: meta.link ? V.verified : V.documented, label: meta.link ? "Verified (event or device result, link provided)" : "Event or device result (no link to verify)" };
    const hand = (opts && opts.handTimed) || meta.method === "hand";
    const elec = ELECTRONIC.has(meta.method) || ELECTRONIC.has(methods.veloDevice) || ELECTRONIC.has(methods.evDevice) || methods.sixty === "laser";
    // No source given but a method is: that's a player-reported number with a known method.
    if (meta.source === "self" || (!meta.source && (hand || elec))) {
      if (hand) return { value: V.selfHand, label: "Self-reported, hand-timed" };
      if (elec) return { value: V.selfElectronic, label: "Self-reported, electronic measurement" };
      return { value: V.selfHand, label: "Self-reported, method not given" };
    }
    return { value: V.unspecified, label: "Source not given" };
  }
  function recencyValue(dateStr, now) {
    const C = CONFIG.confidence;
    if (!dateStr) return { value: C.recencyUnknown, days: null, label: "Measurement date not given" };
    const days = Math.max(0, Math.round(((now || new Date()) - new Date(dateStr + "T12:00:00")) / 864e5));
    const band = C.recency.find(b => days <= b.maxDays);
    return { value: band.value, days, label: days <= 90 ? "Measured in the last 90 days" : days <= 180 ? "Measured 3–6 months ago" : days <= 365 ? "Measured 6–12 months ago" : "Measured over a year ago" };
  }
  function sampleValue(kind, n) {
    const bands = kind === "ip" ? CONFIG.confidence.ipBands : CONFIG.confidence.paBands;
    if (!isNum(n)) return { value: 0, label: kind === "ip" ? "No innings entered" : "No plate appearances entered" };
    const b = bands.find(x => n >= x.min);
    return { value: b.value, label: `${b.label} (${n} ${kind === "ip" ? "IP" : "PA"})` };
  }
  // parts: { completeness, verification, recency, sample } each 0–100. incomplete: cap at incompleteCap.
  function confidenceIndex(parts, incomplete) {
    const W = CONFIG.confidence.weights;
    let score = W.completeness * parts.completeness + W.verification * parts.verification + W.recency * parts.recency + W.sample * parts.sample;
    if (incomplete) score = Math.min(score, CONFIG.confidence.incompleteCap);
    score = Math.round(clamp(score, 0, 100));
    return { score, label: confidenceLabel(score), parts, incomplete: !!incomplete };
  }

  // ---------- Level selection (Phase 3 + 5) ----------
  // levels: [{ key, score (unrounded or null), coreOk, plausible, hasGap }]. ctx: { sufficient }.
  function selectTargets(levels, ctx) {
    const S = CONFIG.selection, byKey = (k) => levels.find(l => l.key === k);
    const ladder = S.ladder.map(byKey).filter(Boolean);
    const round = (l) => isNum(l.score) ? Math.round(l.score) : null;
    const qualifies = (l) => ctx.sufficient && isNum(l.score) && round(l) >= S.primaryMin && l.coreOk;
    const primary = ladder.find(qualifies) || null;
    const scored = ladder.filter(l => isNum(l.score));
    // Closest supported category when nothing qualifies: best score, ties go to the higher level.
    const closest = primary ? null : scored.slice().sort((a, b) => round(b) - round(a) || S.ladder.indexOf(a.key) - S.ladder.indexOf(b.key))[0] || null;
    const anchor = primary || closest;
    let stretch = null, stretchReason = null;
    if (anchor) {
      const i = S.ladder.indexOf(anchor.key);
      const up = i > 0 ? byKey(S.ladder[i - 1]) : null;
      if (!up) stretchReason = "You're already at the top category.";
      else if (!ctx.sufficient) stretchReason = "Not established with current data.";
      else if (!isNum(up.score) || round(up) < S.stretchMin) stretchReason = "Not established with current data.";
      else if (!up.plausible) stretchReason = "Not established with current data: a core tool is too far from that level's benchmark.";
      else if (!up.hasGap) stretchReason = "Not established with current data: no measurable gap to work on.";
      else stretch = up;
    }
    // Additional opportunity: only the next category down from the target, when it scores 80+.
    // (Listing every lower level was noise; JUCO has its own section.)
    const below = anchor ? byKey(S.ladder[S.ladder.indexOf(anchor.key) + 1]) : null;
    const also = below && below !== stretch && isNum(below.score) && round(below) >= S.additionalMin ? [below.key] : [];
    // Ties: levels whose displayed score equals the primary's (or closest's) and share its benchmarks.
    const ties = anchor ? ladder.filter(l => l !== anchor && isNum(l.score) && round(l) === round(anchor)).map(l => l.key) : [];
    return { primary: primary ? primary.key : null, closest: closest ? closest.key : null, stretch: stretch ? stretch.key : null, stretchReason, also, ties, juco: byKey("juco") || null };
  }

  // ---------- Development outlook (Phase 6) ----------
  // history: progress entries (oldest first) for the same primary position; key: metric key.
  function trend(history, key, lowerIsBetter) {
    const pts = (history || []).filter(e => e && e.metrics && isNum(e.metrics[key])).map(e => ({ date: e.measured || e.t.slice(0, 10), v: e.metrics[key], from: e.measured ? "measured" : "saved" }));
    // Keep one point per date (latest wins); never overwrite stored history itself.
    const byDate = new Map(); pts.forEach(p => byDate.set(p.date, p));
    const s = [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : 1);
    if (s.length < 2) return { enough: false, points: s };
    const first = s[0], last = s[s.length - 1];
    const days = Math.round((new Date(last.date) - new Date(first.date)) / 864e5);
    if (days < CONFIG.outlook.minDaysBetween) return { enough: false, points: s };
    const change = Math.round((last.v - first.v) * 100) / 100;
    const perMonth = Math.round(change / (days / 30.44) * 100) / 100;
    const prev = s[s.length - 2], recent = Math.round((last.v - prev.v) * 100) / 100;
    const better = (d) => d === 0 ? "flat" : (lowerIsBetter ? d < 0 : d > 0) ? "improving" : "declining";
    return { enough: true, points: s, first, last, days, change, perMonth, recent, direction: better(change), recentDirection: better(recent) };
  }

  return { MODEL_VERSION, CONFIG, isNum, clamp, classify, confidenceLabel, weighted, verificationValue, recencyValue, sampleValue, confidenceIndex, selectTargets, trend };
});
