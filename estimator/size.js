/* Find My Level: "Your frame" panel (height and weight study, data/size-benchmarks-v1.json).
  Pure functions, no DOM. Context only: nothing here is read by logic.js, and size can never change
  the level result or the highlight rule.
  - College rosters now: the Peach State roster sample, using the pitcher row for a pitching read and
    the position-player row otherwise.
  - Committed high school players: Slammers (all positions) on every read; Flatground too for
    outfielders. Flatground's D1 tiers are its own groups and are not mapped onto our D1 levels.
  - PBR_WI_E stays hidden. Numbers are shown as published; nothing is adjusted or projected.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRLevelSize = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const LEVELS = ["Power 4", "Mid-major D1", "Lower D1", "D2", "D3", "NAIA", "JUCO"];
  const SHORT = { "Power 4": "Power 4", "Mid-major D1": "Mid-Major D1", "Lower D1": "Low-Major D1", D2: "D2", D3: "D3", NAIA: "NAIA", JUCO: "JUCO" };
  const OF = ["LF", "CF", "RF"];
  const NOTE = "College averages come from listed roster heights and weights of players aged 18–23. They show the bodies players grow into, not a requirement. About 1 in 3 college players below Power 4 is under 6'0\".";
  const PBR_FACT = "In PBR's Indiana study, 57.4% of eventual D1 pitchers who were 6'2\" or taller as sophomores signed Power 4, vs 34% of shorter ones. The same study found velocity and spin mattered more than height.";

  // 74.08 -> 6'2.1"   72 -> 6'0"
  function ht(inches, dec) {
    if (!isNum(inches)) return "";
    const d = dec == null ? 1 : dec, f = Math.pow(10, d);
    let ft = Math.floor(inches / 12), r = Math.round((inches - ft * 12) * f) / f;
    if (r >= 12) { ft += 1; r = 0; }
    return `${ft}'${d ? r.toFixed(d) : String(r)}"`;
  }
  const htWhole = (inches) => ht(inches, 0);
  const lb = (w) => isNum(w) ? `${Math.round(w)}` : "";
  const list = (a) => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const inchWord = (n) => n === 1 ? "about 1 inch" : `about ${n} inches`;

  // Which level labels each published HS source gives for each of our rows (none = no published group).
  const SL_KEY = { "Power 4": "Power 4", "Mid-major D1": "Mid-major D1", D2: "D2", D3: "D3", NAIA: "JUCO / NAIA", JUCO: "JUCO / NAIA" };
  const FG_KEY = { D2: "D2", D3: "D3", NAIA: "NAIA" };
  const FG_D1 = ["D1 (Top 100)", "D1 (Mid Tier)", "D1 (Lower Tier)"];
  const hsSrc = (S, id) => (S.hs_recruit_sources || []).find(s => s.source_id === id && s.use !== "hidden_until_owner_review") || null;

  function frame(S, input, read, opts) {
    opts = opts || {};
    if (!S || !S.college_roster_sample) return null;
    const h = isNum(input.heightIn) ? input.heightIn : null, w = isNum(input.weightLb) ? input.weightLb : null;
    if (h == null || w == null) return null; // both are required in the form; a blank value hides the panel
    const pitch = read && read.kind === "pitching";
    const grp = pitch ? "pitchers" : "position";
    const of = !pitch && read && OF.includes(read.position);
    const C = S.college_roster_sample.levels, SL = hsSrc(S, "SL"), FG = of ? hsSrc(S, "FG") : null;
    const you = `${htWhole(h)}, ${w}`;
    const rows = LEVELS.map(k => {
      const c = C[k] || {}, g = c[grp] || {};
      const hs = [];
      if (SL && SL_KEY[k]) hs.push({ src: "SL", label: "All positions", height_in: SL.height_in[SL_KEY[k]], weight_lb: SL.weight_lb[SL_KEY[k]], pooled: SL_KEY[k] === "JUCO / NAIA" });
      if (FG && FG_KEY[k]) hs.push({ src: "FG", label: "Outfielders", height_in: FG.height_in[FG_KEY[k]], weight_lb: FG.weight_lb[FG_KEY[k]] });
      const oneTeam = k === "JUCO" && !!c.note;
      return {
        level: k, short: SHORT[k], you,
        hs, hsText: hs.length ? hs.map(x => `${ht(x.height_in)}, ${lb(x.weight_lb)}${hs.length > 1 ? ` (${x.src === "FG" ? "OF" : "all"})` : ""}`).join(" · ") : "Not published",
        college: { n: g.n, height_in: g.height_in, weight_lb: g.weight_lb, group: grp },
        collegeText: isNum(g.height_in) ? `${ht(g.height_in)}, ${lb(g.weight_lb)}${oneTeam ? "*" : ""}` : "Not published",
        oneTeam, oneTeamNote: oneTeam ? "* JUCO weight comes from one team (Jones College); San Jacinto lists no weights." : null,
        pooledNote: SL_KEY[k] === "JUCO / NAIA" ? "The all-positions high school group pools NAIA and JUCO, so both rows show the same metrics." : null
      };
    });
    const fgD1 = FG ? FG_D1.map(t => ({ tier: t, height_in: FG.height_in[t], weight_lb: FG.weight_lb[t] })) : null;
    return {
      title: "Your frame", kind: pitch ? "pitching" : "position", group: grp,
      groupLabel: pitch ? "College pitchers" : "College position players",
      you, heightIn: h, weightLb: w, rows,
      headline: headline(rows, h, w, pitch),
      note: NOTE,
      fgD1, fgD1Note: fgD1 ? "The outfielder report's D1 tiers are its own groups and aren't matched to our three D1 levels:" : null,
      pitcherFact: pitch && opts.grade === 10 ? PBR_FACT : null,
      about: about(S),
      csvUrl: opts.csvUrl || null
    };
  }

  // One plain sentence (two short clauses at most), chosen by the data. Never "too small" or "too big".
  function headline(rows, h, w, pitch) {
    const at = `At ${htWhole(h)}, ${w}`;
    const who = pitch ? "pitcher" : "position player";
    const diffs = rows.filter(r => isNum(r.college.height_in)).map(r => ({ level: r.level, d: h - r.college.height_in, mean: r.college.height_in }));
    const near = diffs.filter(x => Math.abs(x.d) <= 0.5).map(x => x.level);
    const p4 = diffs.find(x => x.level === "Power 4");
    const p4Gap = p4 ? Math.round(p4.mean - h) : 0;
    const p4Tail = p4 && !near.includes("Power 4") && p4Gap >= 1
      ? (pitch ? ` Power 4 pitchers run ${inchWord(p4Gap)} taller.` : ` Power 4 position players run ${inchWord(p4Gap)} taller; the biggest size gap between levels is among pitchers.`)
      : "";
    const range = (lv) => lv.length >= 2 ? `${lv[0]}–${lv[lv.length - 1]}` : lv[0];
    if (near.length) {
      const contiguous = near.every((l, i) => i === 0 || LEVELS.indexOf(l) === LEVELS.indexOf(near[i - 1]) + 1);
      return `${at} you're right around the ${contiguous ? range(near) : list(near)} roster average for a ${who}.${p4Tail}`;
    }
    if (diffs.every(x => x.d > 0.5)) return `${at} you're taller than the average college ${who} at every level, Power 4 included.`;
    if (diffs.every(x => x.d < -0.5)) {
      const gapBelow = Math.round(Math.min(...diffs.filter(x => x.level !== "Power 4").map(x => -x.d)));
      return `${at} you're ${inchWord(Math.max(gapBelow, 1))} under the average college ${who} below Power 4. Plenty of college players are your height: about 1 in 3 below Power 4 is under 6'0".`.replace(/ Plenty.*$/, h < 72 ? " Plenty of college players are your height: about 1 in 3 below Power 4 is under 6'0\"." : "");
    }
    const closest = diffs.slice().sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
    return `${at} you're closest to the ${closest.level} roster average for a ${who}.${p4Tail}`;
  }

  function about(S) {
    const cs = S.college_roster_sample, L = cs.levels;
    return {
      source: cs.source, limitations: cs.limitations,
      levels: LEVELS.map(k => { const c = L[k]; return { level: k, teams: c.teams, n: c.n != null ? c.n : c.n_height, nWeight: c.n_weight, height: ht(c.mean_height_in), weight: lb(c.mean_weight_lb), pct62: c.pct_6_2_plus, pctUnder6: c.pct_under_6_0, note: c.note || null }; }),
      hs: (S.hs_recruit_sources || []).filter(s => s.use !== "hidden_until_owner_review").map(s => ({ id: s.source_id, group: s.group, fact: s.fact || null }))
    };
  }

  return { frame, headline, ht, htWhole, LEVELS, NOTE, PBR_FACT };
});
