/*
  Find My Level: presentation summary (v13).
  Pure functions that turn an existing logic.js read into the short main-view answer:
  headline, next step, one status per level, a match percentage per level,
  a recommendation outlook, and per-metric bars versus a listed target.
  Percentages are derived from the read's existing statuses (share of entered metrics
  that meet that level's published target). They change no highlight or target number.

  Level status (documented in README):
    Meets targets        the level passes the existing highlight rule (logic.js).
    Close                not highlighted, at least one compared tool meets its published
                         target and at least one is below it (partly met).
    Below targets        compared tools exist there and none meets.
    Needs more metrics   published targets exist but too few of your metrics could be
                         compared (not entered, or fewer tools than the rule needs).
    No published target  the source has no classifiable target for any tool at that level.
  Next step: the nearest level above the headline level that has a metric below target
  (no headline: the level with the fewest metrics below target; ties go to the later
  level in the list). Of that level's gaps, only the smallest relative to its target
  (gap / threshold) is shown.
  Outlook / metric bars: derived from the same comparisons. Bars use the headline
  level's existing targets (or the next-step level if there is no headline). Height,
  weight and GPA are never included.
*/
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./logic.js") : root.PSRLevel);
  if (typeof module === "object" && module.exports) module.exports = api; else root.PSRLevelSummary = api;
})(typeof self !== "undefined" ? self : this, function (L) {
  const S = L.S;
  const ST = { MEETS: "Meets targets", CLOSE: "Close", BELOW: "Below targets", NEED: "Needs more metrics", NONE: "No published target" };
  const SHORT = { p4: "Power D1", mid: "Mid-major D1", low: "Lower D1", d2: "D2", d3: "D3", naia: "NAIA", juco: "JUCO" };
  const LONG = { p4: "Power conference D1", mid: "mid-major D1", low: "lower D1", d2: "D2", d3: "D3", naia: "NAIA", juco: "JUCO" };
  const NEXT = { p4: "Power conference D1", mid: "Mid-major D1", low: "Lower D1", d2: "D2", d3: "D3", naia: "NAIA", juco: "JUCO" };
  const POS = { P: "pitcher", C: "catcher", "1B": "first baseman", "2B": "second baseman", SS: "shortstop", "3B": "third baseman", LF: "left fielder", CF: "center fielder", RF: "right fielder" };
  const TAB = { P: "Pitcher", C: "Catcher", "1B": "First base", "2B": "Second base", SS: "Shortstop", "3B": "Third base", LF: "Left field", CF: "Center field", RF: "Right field" };
  const NOUN = { hitting: "max exit velocity", running: "60-yard dash", throwing: "throw", pitching: "fastball" };
  const SUBJ = { hitting: "Your exit velocity", running: "Your 60", pitching: "Your fastball" };

  const fmt = (t) => t.unit === "seconds" ? t.value.toFixed(2) + " s" : t.value + " mph";
  const subj = (t, k) => SUBJ[k] || (/pop/i.test(t.metric || "") ? "Your pop time" : "Your throw");
  const noun = (t, k) => k === "throwing" && /pop/i.test(t.metric || "") ? "pop time" : NOUN[k];
  const andList = (a) => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

  function levelStatus(read, c) {
    const tools = read.toolKeys.map(k => c.tools[k]);
    if (c.highlighted) return ST.MEETS;
    if (!tools.some(t => t.status !== S.NO_BENCH && t.status !== S.REF_ONLY)) return ST.NONE;
    const cmp = c.compared.map(k => c.tools[k]);
    const met = cmp.filter(t => t.status === S.MEETS).length, below = cmp.filter(t => t.status === S.BELOW).length;
    if (!cmp.length || !below) return ST.NEED;
    return met ? ST.CLOSE : ST.BELOW;
  }
  const levels = (read) => read.categories.map(c => ({ key: c.key, label: SHORT[c.key], status: levelStatus(read, c) }));

  // Match percentage: share of entered metrics that meet this level's existing published
  // target (the same guideline comparisons already used for status). Height and weight are
  // never counted. Missing benchmarks stay missing (not treated as misses). This does not
  // change the highlight rule or rank levels.
  const MATCH_DISC = "These percentages are estimates based only on your metrics. They don't account for grades, film, coach evaluations or anything else, and they aren't a guarantee of recruitment.";
  function matchShare(read) {
    const minTools = read.kind === "pitching" ? 1 : 2;
    const enough = read.categories.some(c => c.compared.length >= minTools);
    const levels = read.categories.map(c => {
      const of = c.compared.length;
      const met = c.compared.filter(k => c.tools[k].status === S.MEETS).length;
      if (!enough) return { key: c.key, label: SHORT[c.key], show: false, reason: "not-enough" };
      if (of === 0) {
        const hasTarget = read.toolKeys.some(k => {
          const t = c.tools[k];
          return t && t.status !== S.NO_BENCH && t.status !== S.REF_ONLY;
        });
        return { key: c.key, label: SHORT[c.key], show: false, reason: hasTarget ? "not-enough-here" : "no-target" };
      }
      if (of < minTools) return { key: c.key, label: SHORT[c.key], show: false, reason: "not-enough-here" };
      return { key: c.key, label: SHORT[c.key], show: true, pct: Math.round((met / of) * 100), met, of };
    });
    const message = enough ? null : (read.kind === "pitching"
      ? "Not enough metrics were entered to estimate a match percentage. Enter your fastball velocity to compare it with the published targets."
      : "Not enough metrics were entered to estimate a match percentage. A position comparison needs at least 2 of your entered metrics that have a published target.");
    return { enough, minTools, levels, message, disclaimer: MATCH_DISC };
  }

  function headline(read) {
    const first = read.categories.find(c => c.highlighted);
    const pitch = read.kind === "pitching";
    if (first) {
      const parts = first.compared.map(k => `${noun(first.tools[k], k)} (${fmt(first.tools[k])})`);
      return { level: first.key, levelName: LONG[first.key],
        text: pitch ? `Your fastball meets the listed ${LONG[first.key]} velocity target.` : `Your metrics meet the listed ${LONG[first.key]} targets.`,
        support: pitch ? `Based on your ${read.basis} (${fmt(first.tools.pitching)}) only. Velocity is one part of a pitcher evaluation.` : `Supported by your ${andList(parts)}.` };
    }
    const cmpAny = read.categories.some(c => c.compared.some(k => c.tools[k].status === S.BELOW));
    if (cmpAny) return { level: null, levelName: null,
      text: pitch ? "Your fastball is below the listed velocity targets we could compare." : "Your metrics don't fully meet any level's listed targets yet.",
      support: "That's a snapshot of today's metrics, not a ceiling. The closest gap is below." };
    const most = Math.max(0, ...read.categories.map(c => c.compared.length));
    return { level: null, levelName: null, text: "More information needed for an overall range.",
      support: pitch ? "Add your fastball velocity and throwing hand to compare it with the published targets."
        : most ? `Only ${most} of your metrics has a published target at the same level for a ${POS[read.position]}, and a level needs at least 2.` : "Add your core metrics to compare them with the published targets." };
  }

  function gapLine(c, read) {
    const below = read.toolKeys.filter(k => c.tools[k].status === S.BELOW && c.compared.includes(k));
    if (!below.length) return null;
    below.sort((a, b) => (c.tools[a].gap / c.tools[a].threshold) - (c.tools[b].gap / c.tools[b].threshold));
    const k = below[0], t = c.tools[k];
    const gap = t.unit === "seconds" ? `${t.gap.toFixed(2)} s slower than the listed ${t.threshold.toFixed(2)} s` : `${t.gap} mph short of the listed ${t.threshold} mph`;
    return { tool: k, more: below.length - 1, text: `${subj(t, k)} is ${gap}.` };
  }

  function nextStep(read) {
    const h = headline(read), cats = read.categories;
    let target = null;
    if (h.level) {
      const i = cats.findIndex(c => c.key === h.level);
      for (let j = i - 1; j >= 0 && !target; j--) if (gapLine(cats[j], read)) target = cats[j];
      if (!target) return i === 0 ? { level: null, text: "You meet the highest listed level. Keep your metrics current and get them in front of coaches." } : null;
    } else {
      let best = null;
      cats.forEach(c => { const g = gapLine(c, read); if (!g) return; const n = g.more + 1; if (!best || n <= best.n) best = { c, n }; });
      if (best) target = best.c;
    }
    if (!target) return null;
    const g = gapLine(target, read);
    return { level: target.key, tool: g.tool, more: g.more,
      text: `Next benchmark: ${NEXT[target.key]}. ${g.text}${g.more ? ` ${g.more === 1 ? "One other metric is" : g.more + " other metrics are"} also below this target.` : ""}` };
  }

  function title(read) { return `Your results as a ${POS[read.position] || read.position}.`; }
  function tabLabel(read) { return TAB[read.position] || read.position; }

  // Keep source names out of the main view; Sources names them.
  const SWAPS = [
    [/NextCommit publishes no/g, "There's no published"], [/NCSA publishes no/g, "The second target source has no"],
    [/the separate NCSA reference/g, "the second published target"], [/NCSA lists all of D1 as one group/g, "This second source lists all of D1 as one group"],
    [/NCSA combines/g, "This second source combines"], [/combined NextCommit targets/g, "combined published targets"],
    [/NextCommit doesn't say whether its targets are/g, "The published targets don't say whether they're"], [/NextCommit's listed/g, "the listed"],
    [/BaseballPath used best PBR showcase results/g, "This group's metrics are best showcase results"], [/BaseballPath reports/g, "This group reports"],
    [/BaseballPath publishes no/g, "This group has no published"], [/Slammers measured/g, "This group was measured"], [/Slammers used/g, "This group used"],
    [/and Slammers used/g, "and this group used"], [/ \(Flatground:[^)]*\)/g, ""],
    [/NextCommit/g, "the published targets"], [/NCSA/g, "the second target source"], [/BaseballPath/g, "the committed-player group"],
    [/Flatground/g, "the outfielder group"], [/Slammers/g, "the rising-senior group"], [/No published benchmark/g, "No published target"]
  ];
  const deSource = (s) => SWAPS.reduce((a, [re, to]) => a.replace(re, to), String(s == null ? "" : s));


  // "What moves you up" (v26): the exact targets that move this read up from where it is now.
  // Only arithmetic against the listed targets; it never predicts improvement or an offer.
  //   next: the nearest level above the current one, with every below-target metric to fix there
  //   jump: if fixing ONE metric reaches an even higher level, that single change
  //   add:  metrics not entered that would add a comparison
  const ACTION = {
    hitting: (t) => `Hit ${t.threshold} mph max exit velocity`,
    running: (t) => `Run a ${t.threshold.toFixed(2)} or faster 60`,
    pitching: (t) => `Get your fastball to ${t.threshold} mph`,
    throwing: (t) => /pop/i.test(t.metric || "") ? `Pop ${t.threshold.toFixed(2)} or faster to second` : `Throw ${t.threshold} mph ${/outfield/i.test(t.positionLabel || "") || t.positionLabel === "OF" ? "from the outfield" : "across the infield"}`
  };
  function step(k, t) {
    const gap = t.unit === "seconds" ? `${t.gap.toFixed(2)} s faster` : `+${t.gap} mph`;
    return { tool: k, threshold: t.threshold, value: t.value, gap: t.gap, unit: t.unit, estimated: !!t.estimated,
      action: ACTION[k](t), you: fmt(t), change: gap };
  }
  function movesUp(read) {
    const order = read.categories;
    const cur = order.findIndex(c => c.highlighted);
    const add = [...new Set(order.flatMap(c => c.missing.filter(x => x.status === S.NO_INPUT).map(x => x.tool)))];
    if (cur === 0) return { top: true, add, text: "You meet the highest listed level. Keep your metrics current and get them in front of coaches." };
    const above = (cur === -1 ? order : order.slice(0, cur)).slice().reverse(); // nearest level first
    const minTools = read.kind === "pitching" ? 1 : 2;
    const reachable = above.filter(c => c.compared.length >= minTools);
    if (!reachable.length) return { top: false, next: null, jump: null, add, text: add.length ? `Add your ${add.map(k => NOUN[k]).join(" and ")} to see exactly what moves you up.` : "Add more metrics to see exactly what moves you up." };
    const fix = (c) => c.compared.filter(k => c.tools[k].status === S.BELOW).map(k => step(k, c.tools[k]));
    // The highest level that a set of changes reaches (every compared metric there meets its target).
    const reach = (steps) => {
      const val = (k, t) => { const s = steps.find(x => x.tool === k); return s && (t.direction === "higher_is_better" ? s.threshold > t.value : s.threshold < t.value) ? s.threshold : t.value; };
      const ok = (c) => c.compared.length >= minTools && c.compared.every(k => { const t = c.tools[k], v = val(k, t); return t.direction === "higher_is_better" ? v >= t.threshold - 1e-9 : v <= t.threshold + 1e-9; });
      return order.find(c => ok(c)) || null;
    };
    const nextCat = reachable[0], nextSteps = fix(nextCat);
    const landed = reach(nextSteps) || nextCat;
    const next = { level: landed.key, label: NEXT[landed.key], steps: nextSteps };
    // One single change that goes higher still (position players only)
    let jump = null;
    if (read.kind !== "pitching") {
      for (const c of order) {
        if (order.indexOf(c) >= order.indexOf(landed)) break;
        const f = fix(c);
        if (f.length === 1 && c.compared.length >= minTools) { const to = reach(f); if (to && order.indexOf(to) < order.indexOf(landed)) { jump = { level: to.key, label: NEXT[to.key], steps: f }; break; } }
      }
    }
    const one = next.steps.length === 1;
    const text = one ? `${next.steps[0].action} to reach the listed ${NEXT[next.level]} targets.` : `To reach ${NEXT[next.level]}: ${andList(next.steps.map(x => x.action.charAt(0).toLowerCase() + x.action.slice(1)))}.`;
    return { top: false, next, jump, add, text: text.charAt(0).toUpperCase() + text.slice(1) };
  }



  const GAP_NAME = (t, k) => k === "hitting" ? "exit velocity" : k === "running" ? "60-yard" : k === "pitching" ? "fastball" : /pop/i.test(t.metric || "") ? "pop time" : "throw";
  const tgtFmt = (t) => t.unit === "seconds" ? t.threshold.toFixed(2) + " s" : t.threshold + " mph";

  function gapItems(c, read) {
    return read.toolKeys.filter(k => c.tools[k].status === S.BELOW && c.compared.includes(k)).map(k => {
      const t = c.tools[k];
      const name = GAP_NAME(t, k);
      const you = fmt(t);
      const tgt = tgtFmt(t);
      const mid = t.unit === "seconds" ? "is slower than" : `is ${t.gap} mph short of`;
      return { tool: k, name, value: t.value, threshold: t.threshold, unit: t.unit,
        text: `Your ${name} ${you} ${mid} the ${SHORT[c.key]} target of ${tgt}.` };
    });
  }

  // Recommendation copy from the headline and any entered metrics that are below
  // the next level's existing target. No odds or guarantee language.
  function outlook(read) {
    const h = headline(read), cats = read.categories;
    let target = null, follow = null;
    if (h.level) {
      const i = cats.findIndex(c => c.key === h.level);
      for (let j = i - 1; j >= 0 && !target; j--) if (gapItems(cats[j], read).length) target = cats[j];
      if (!target && i === 0) follow = "You meet the highest listed level. Keep your metrics current and get them in front of coaches.";
    } else {
      let best = null;
      cats.forEach(c => { const n = gapItems(c, read).length; if (!n) return; if (!best || n <= best.n) best = { c, n }; });
      if (best) target = best.c;
    }
    const gaps = target ? gapItems(target, read) : [];
    const parts = [h.text];
    if (gaps.length) parts.push(gaps.map(g => g.text).join(" "));
    else if (follow) parts.push(follow);
    return { headlineText: h.text, level: h.level, nextLevel: target ? target.key : null, nextLabel: target ? SHORT[target.key] : null, gaps, follow, text: parts.join(" ") };
  }

  // Bars for entered metrics that already have a usable comparison at the headline
  // level (or the next-step level if there is no headline). Fill is a visual of
  // value vs that existing threshold only; it is not a new benchmark or a labeled %.
  function metricSummary(read) {
    const h = headline(read);
    let cat = h.level ? read.categories.find(c => c.key === h.level) : null;
    if (!cat) {
      const n = nextStep(read);
      cat = (n && n.level && read.categories.find(c => c.key === n.level)) || read.categories.find(c => c.compared.length) || null;
    }
    if (!cat) return { level: null, levelLabel: null, bars: [] };
    const bars = cat.compared.map(k => {
      const t = cat.tools[k];
      const meets = t.status === S.MEETS;
      let fill = 1;
      if (!meets && t.value != null && t.threshold) {
        fill = t.direction === "higher_is_better" ? t.value / t.threshold : t.threshold / t.value;
        fill = Math.max(0, Math.min(1, fill));
      }
      return {
        key: k, label: t.metric || k, value: t.value, unit: t.unit, valueText: fmt(t),
        threshold: t.threshold, band: t.band,
        targetText: t.band || tgtFmt(t),
        status: meets ? "MEETS" : "BELOW",
        direction: t.direction,
        fill: meets ? 1 : fill
      };
    });
    return { level: cat.key, levelLabel: SHORT[cat.key], bars };
  }

  // Schools and camps linked from the result: the headline (meets-targets) level and below.
  // CLOSE is not a match. Finder filters use directory labels (all of D1 is "NCAA D1");
  // the visible label keeps the actual tier, so Power/mid-major are not named unless met.
  const FINDER = { p4: "NCAA D1", mid: "NCAA D1", low: "NCAA D1", d2: "NCAA D2", d3: "NCAA D3", naia: "NAIA", juco: "JUCO" };
  const TIER = { p4: "Power D1", mid: "Mid-major D1", low: "Lower D1", d2: "D2", d3: "D3", naia: "NAIA", juco: "JUCO" };
  const ORDER = ["p4", "mid", "low", "d2", "d3", "naia", "juco"];
  function schoolsAtLevel(read) {
    const h = headline(read);
    if (!h.level) return { atLevel: false, filters: [], bands: [], labels: [] };
    // Your level plus the next one down: a realistic list instead of every school below you.
    const keys = ORDER.slice(ORDER.indexOf(h.level), ORDER.indexOf(h.level) + 2);
    const filters = [...new Set(keys.map(k => FINDER[k]))];
    const labels = [keys.map(k => TIER[k]).join(" and ")];
    return { atLevel: true, filters, bands: keys, labels, top: h.level };
  }

  return { ST, SHORT, LONG, POS, levelStatus, levels, matchShare, MATCH_DISC, headline, nextStep, outlook, metricSummary, movesUp, schoolsAtLevel, title, tabLabel, deSource,
    CAVEAT: "A benchmark comparison, not a prediction. Coaches also weigh game performance and roster needs." };
});
