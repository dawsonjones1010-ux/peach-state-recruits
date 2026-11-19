/*
  College Baseball Level Estimator: configuration (no benchmark numbers live here).
  Every number used for a comparison comes from data/level-benchmarks-v1.0.json.

  This file holds the product decisions that the research package asked us to keep
  isolated and documented:
    - how the seven comparison categories map to each source's own labels
    - how positions map to each source's position groups
    - the "provisional range" highlight rule (a product heuristic, NOT a validated prediction)
    - input validation ranges (to catch typos; they are not benchmarks)
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRLevelConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DATA_URL = "data/level-benchmarks-v1.0.json";

  // The seven comparison categories, in a fixed display order. The order is for reading only:
  // D2, D3, NAIA and JUCO overlap and are NOT a strict descending talent ladder.
  // nc = NextCommit label (the provisional guideline family). ns = the NCSA row that covers this
  // category (shown as a separate reference; "D1 (all)" and "D3 / NAIA" are pooled source groups).
  const CATEGORIES = [
    { key: "p4",   label: "Power conference D1", nc: "Power 4",      ns: "D1 (all)",  d1Tier: 1 },
    { key: "mid",  label: "Mid major D1",        nc: "Mid-major D1", ns: "D1 (all)",  d1Tier: 2 },
    { key: "low",  label: "Lower D1",            nc: "Lower D1",     ns: "D1 (all)",  d1Tier: 3 },
    { key: "d2",   label: "D2",                  nc: "D2",           ns: "D2" },
    { key: "d3",   label: "D3",                  nc: "D3",           ns: "D3 / NAIA" },
    { key: "naia", label: "NAIA",                nc: "NAIA",         ns: "D3 / NAIA" },
    { key: "juco", label: "JUCO",                nc: "JUCO",         ns: "JUCO" }
  ];

  const POSITIONS = [
    { code: "P",  label: "Pitcher (P)" },
    { code: "C",  label: "Catcher (C)" },
    { code: "1B", label: "First base (1B)" },
    { code: "2B", label: "Second base (2B)" },
    { code: "SS", label: "Shortstop (SS)" },
    { code: "3B", label: "Third base (3B)" },
    { code: "LF", label: "Left field (LF)" },
    { code: "CF", label: "Center field (CF)" },
    { code: "RF", label: "Right field (RF)" }
  ];

  // Position -> each source's published position group. null = that source publishes no group
  // for this position, so the comparison stays "No published benchmark" (never borrowed).
  const POSITION_GROUPS = {
    //        NC exit velo  NC 60-yard        BP group   NS throw group   throw test   family
    "C":  { ncEv: "C",     ncRun: "C",         bp: "C",     nsThrow: null,    throwTest: "catcher", family: "C"  },
    "1B": { ncEv: "1B/3B", ncRun: null,        bp: "1B/3B", nsThrow: null,    throwTest: "infield", family: "IF" },
    "2B": { ncEv: "SS/2B", ncRun: "SS/2B",     bp: "SS/2B", nsThrow: "SS/2B", throwTest: "infield", family: "IF" },
    "SS": { ncEv: "SS/2B", ncRun: "SS/2B",     bp: "SS/2B", nsThrow: "SS/2B", throwTest: "infield", family: "IF" },
    "3B": { ncEv: "1B/3B", ncRun: null,        bp: "1B/3B", nsThrow: "3B",    throwTest: "infield", family: "IF" },
    // LF/RF running maps to Corner OF and CF to CF (NC). Exit velo and throwing use the source's
    // broader OF group because that is the published group.
    "LF": { ncEv: "OF",    ncRun: "Corner OF", bp: "OF",    nsThrow: "OF",    throwTest: "outfield", family: "OF" },
    "CF": { ncEv: "OF",    ncRun: "CF",        bp: "OF",    nsThrow: "OF",    throwTest: "outfield", family: "OF" },
    "RF": { ncEv: "OF",    ncRun: "Corner OF", bp: "OF",    nsThrow: "OF",    throwTest: "outfield", family: "OF" }
  };

  // Distinct core tools for a position-player read. Best and average readings of one tool are
  // never two tools. Catcher pop time and catcher arm strength are one tool (catcher throwing).
  const TOOLS = {
    hitting:  { label: "Hitting (max exit velocity)" },
    running:  { label: "Running (60-yard dash)" },
    throwing: { label: "Position throwing" },
    pitching: { label: "Fastball velocity" }
  };

  /*
    PROVISIONAL RANGE HIGHLIGHT RULE (product heuristic; not a validated prediction)
    A category is highlighted for a position player only when:
      - at least `minDistinctCoreTools` distinct core tools have a usable guideline comparison
        from the `guidelineFamily` source in that category, and
      - every compared core tool meets that category's listed target.
    Compared and missing tools are always shown next to a highlight.
    NCSA rows are displayed as a separate reference and are not part of the rule, because the
    package names NextCommit as the one consistent provisional guideline family.
    Pitchers: the sourced table is velocity-only, so a pitcher read highlights categories whose
    listed fastball target is met and is always labeled "Velocity comparison only".
    Categories are never ranked by number or percentage of matches.
  */
  const HIGHLIGHT_RULE = {
    guidelineFamily: "NC",
    minDistinctCoreTools: 2,
    requireEveryComparedToolToMeet: true,
    pitcherLabel: "Velocity comparison only"
  };

  // Typo guards, not benchmarks. `hard` = must be fixed. `soft` = unusual; the player confirms.
  const RANGES = {
    age:          { hard: [8, 30],     soft: [12, 23],   unit: "years" },
    gradYear:     { hard: [2020, 2040], unit: "year" },
    heightIn:     { hard: [48, 90],    soft: [60, 82],   unit: "inches" },
    weightLb:     { hard: [70, 400],   soft: [110, 280], unit: "lb" },
    maxFb:        { hard: [35, 110],   soft: [55, 100],  unit: "mph" },
    typFb:        { hard: [35, 110],   soft: [50, 98],   unit: "mph" },
    maxEv:        { hard: [30, 130],   soft: [60, 112],  unit: "mph" },
    avgEv:        { hard: [20, 130],   soft: [45, 105],  unit: "mph" },
    sixty:        { hard: [5.5, 11],   soft: [6.2, 9],   unit: "seconds" },
    thirty:       { hard: [3, 7],      soft: [3.5, 5.5], unit: "seconds" },
    ifVelo:       { hard: [35, 110],   soft: [55, 98],   unit: "mph" },
    ofVelo:       { hard: [35, 110],   soft: [55, 100],  unit: "mph" },
    cVelo:        { hard: [35, 110],   soft: [55, 92],   unit: "mph" },
    pop:          { hard: [1.5, 3.5],  soft: [1.75, 2.6], unit: "seconds" },
    avg:          { hard: [0, 1],      unit: "ratio" },
    obp:          { hard: [0, 1],      unit: "ratio" },
    slg:          { hard: [0, 4],      unit: "ratio" },
    era:          { hard: [0, 100],    unit: "runs / 9 innings" },
    whip:         { hard: [0, 20],     unit: "(H+BB) / inning" },
    strikePct:    { hard: [0, 100],    unit: "percent" }
  };

  const NOTE = "This compares your current metrics with published benchmarks. Coaches also evaluate game performance, defense, projection and roster needs. It does not predict an offer.";

  return { DATA_URL, CATEGORIES, POSITIONS, POSITION_GROUPS, TOOLS, HIGHLIGHT_RULE, RANGES, NOTE };
});
