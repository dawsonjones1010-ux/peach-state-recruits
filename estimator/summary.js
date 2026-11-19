/*
  Find My Level: presentation summary (v13).
  Pure functions that turn an existing logic.js read into the short main-view answer:
  headline, next step, and one status per level. Adds no numbers and changes no
  calculation; everything comes from the read's existing statuses, thresholds and gaps.

  Level status (documented in README):
    Meets targets        the level passes the existing highlight rule (logic.js).
    Close                not highlighted, at least one compared tool meets its published
                         target and at least one is below it (partly met).
    Below targets        compared tools exist there and none meets.
    Needs more numbers   published targets exist but too few of your numbers could be
                         compared (not entered, or fewer tools than the rule needs).
    No published target  the source has no classifiable target for any tool at that level.
  Next step: the nearest level above the headline level that has a number below target
  (no headline: the level with the fewest numbers below target; ties go to the later
  level in the list). Of that level's gaps, only the smallest relative to its target
  (gap / threshold) is shown.
*/
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./logic.js") : root.PSRLevel);
  if (typeof module === "object" && module.exports) module.exports = api; else root.PSRLevelSummary = api;
})(typeof self !== "undefined" ? self : this, function (L) {
  const S = L.S;
  const ST = { MEETS: "Meets targets", CLOSE: "Close", BELOW: "Below targets", NEED: "Needs more numbers", NONE: "No published target" };
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

  function headline(read) {
    const first = read.categories.find(c => c.highlighted);
    const pitch = read.kind === "pitching";
    if (first) {
      const parts = first.compared.map(k => `${noun(first.tools[k], k)} (${fmt(first.tools[k])})`);
      return { level: first.key, levelName: LONG[first.key],
        text: pitch ? `Your fastball meets the listed ${LONG[first.key]} velocity target.` : `Your numbers meet the listed ${LONG[first.key]} targets.`,
        support: pitch ? `Based on your ${read.basis} (${fmt(first.tools.pitching)}) only. Velocity is one part of a pitcher evaluation.` : `Supported by your ${andList(parts)}.` };
    }
    const cmpAny = read.categories.some(c => c.compared.some(k => c.tools[k].status === S.BELOW));
    if (cmpAny) return { level: null, levelName: null,
      text: pitch ? "Your fastball is below the listed velocity targets we could compare." : "Your numbers don't fully meet any level's listed targets yet.",
      support: "That's a snapshot of today's numbers, not a ceiling. The closest gap is below." };
    const most = Math.max(0, ...read.categories.map(c => c.compared.length));
    return { level: null, levelName: null, text: "More information needed for an overall range.",
      support: pitch ? "Add your fastball velocity and throwing hand to compare it with the published targets."
        : most ? `Only ${most} of your numbers has a published target at the same level for a ${POS[read.position]}, and a level needs at least 2.` : "Add your core numbers to compare them with the published targets." };
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
      if (!target) return i === 0 ? { level: null, text: "You meet the highest listed level. Keep your numbers current and get them in front of coaches." } : null;
    } else {
      let best = null;
      cats.forEach(c => { const g = gapLine(c, read); if (!g) return; const n = g.more + 1; if (!best || n <= best.n) best = { c, n }; });
      if (best) target = best.c;
    }
    if (!target) return null;
    const g = gapLine(target, read);
    return { level: target.key, tool: g.tool, more: g.more,
      text: `Next benchmark: ${NEXT[target.key]}. ${g.text}${g.more ? ` ${g.more === 1 ? "One other number is" : g.more + " other numbers are"} also below this target.` : ""}` };
  }

  function title(read) { return `Your results as a ${POS[read.position] || read.position}.`; }
  function tabLabel(read) { return TAB[read.position] || read.position; }

  // Keep source names out of the main view; Sources names them.
  const SWAPS = [
    [/NextCommit publishes no/g, "There's no published"], [/NCSA publishes no/g, "The second target source has no"],
    [/the separate NCSA reference/g, "the second published target"], [/NCSA lists all of D1 as one group/g, "This second source lists all of D1 as one group"],
    [/NCSA combines/g, "This second source combines"], [/combined NextCommit targets/g, "combined published targets"],
    [/NextCommit doesn't say whether its targets are/g, "The published targets don't say whether they're"], [/NextCommit's listed/g, "the listed"],
    [/BaseballPath used best PBR showcase results/g, "This group's numbers are best showcase results"], [/BaseballPath reports/g, "This group reports"],
    [/BaseballPath publishes no/g, "This group has no published"], [/Slammers measured/g, "This group was measured"], [/Slammers used/g, "This group used"],
    [/and Slammers used/g, "and this group used"], [/ \(Flatground:[^)]*\)/g, ""],
    [/NextCommit/g, "the published targets"], [/NCSA/g, "the second target source"], [/BaseballPath/g, "the committed-player group"],
    [/Flatground/g, "the outfielder group"], [/Slammers/g, "the rising-senior group"], [/No published benchmark/g, "No published target"]
  ];
  const deSource = (s) => SWAPS.reduce((a, [re, to]) => a.replace(re, to), String(s == null ? "" : s));

  return { ST, SHORT, LONG, POS, levelStatus, levels, headline, nextStep, title, tabLabel, deSource,
    CAVEAT: "A benchmark comparison, not a prediction. Coaches also weigh game performance and roster needs." };
});
