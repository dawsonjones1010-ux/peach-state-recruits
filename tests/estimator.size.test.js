// v18: "Your frame" (height and weight study). Height and weight are REQUIRED in the form (owner
// override of 6.5), and are context only: they never change the level result or the highlight rule.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const L = require("../estimator/logic.js"), U = require("../estimator/summary.js"), Z = require("../estimator/size.js");
const V = require("../estimator/v2.js"), CFG = require("../estimator/config.js");
const rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
const data = rd("data/level-benchmarks-v1.0.json"), S = rd("data/size-benchmarks-v1.json");
const base = (o) => Object.assign({ gradYear: 2027, primary: "SS", secondary: "", throws: "R", bats: "R", heightIn: 72, weightLb: 180, metrics: {}, methods: {}, meta: {} }, o);
const hl = (r) => r.reads.map(x => ({ cats: x.categories.filter(c => c.highlighted).map(c => c.key), head: U.headline(x), levels: U.levels(x) }));

test("size data file is Part 6.4 exactly, context only, CSV shipped", () => {
  assert.equal(CFG.SIZE_URL, "data/size-benchmarks-v1.json");
  assert.equal(S.schema_version, "size-1.0"); assert.equal(S.use, "context_panel_only"); assert.equal(S.exclude_from_automatic_classification, true);
  const P4 = S.college_roster_sample.levels["Power 4"];
  assert.deepEqual([P4.n, P4.mean_height_in, P4.mean_weight_lb, P4.pitchers.height_in, P4.position.weight_lb], [125, 74.08, 206.4, 74.9, 203.5]);
  assert.equal(S.college_roster_sample.levels.JUCO.n_weight, 35);
  const csv = fs.readFileSync(path.join(__dirname, "../data/PSR_College_Roster_Size_Sample_2026.csv"), "utf8").trim().split("\n");
  assert.equal(csv.length - 1, 751); assert.match(csv[0], /source_url/);
});

test("height and weight are required, with friendly errors like grad year", () => {
  let v = L.validate(base({ heightIn: null }));
  assert.ok(v.errors.some(e => e.field === "heightIn" && e.msg === "Enter height (feet and inches)."));
  v = L.validate(base({ weightLb: null }));
  assert.ok(v.errors.some(e => e.field === "weightLb" && e.msg === "Enter weight in pounds."));
  v = L.validate(base({ heightIn: null, weightLb: null, gradYear: null }));
  assert.deepEqual(["gradYear", "heightIn", "weightLb"].map(f => v.errors.some(e => e.field === f)), [true, true, true]);
  assert.equal(L.validate(base({})).errors.filter(e => /height|weight/i.test(e.field)).length, 0);
  assert.ok(L.validate(base({ heightIn: 40 })).errors.some(e => e.field === "heightIn"));
  assert.ok(L.validate(base({ weightLb: 95 })).warnings.some(e => e.field === "weightLb"));
});

test("height and weight never change the highlighted level or the level result", () => {
  const cases = [
    { primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } },
    { primary: "P", throws: "R", metrics: { maxFb: 86 } },
    { primary: "P", throws: "L", metrics: { maxFb: 84 } },
    { primary: "SS", secondary: "P", metrics: { maxFb: 86, maxEv: 90, sixty: 6.9, ifVelo: 84 } },
    { primary: "C", metrics: { maxEv: 91, sixty: 7.2, cVelo: 80, pop: 1.95 } }
  ];
  for (const c of cases) {
    const ref = hl(L.evaluate(data, base(Object.assign({}, c, { heightIn: 72, weightLb: 180 }))));
    assert.ok(ref.some(x => x.cats.length), `${c.primary}: reference case highlights at least one level`);
    for (const [h, w] of [[64, 130], [70, 170], [75, 205], [76, 215], [80, 260]]) {
      const r = L.evaluate(data, base(Object.assign({}, c, { heightIn: h, weightLb: w })));
      assert.deepEqual(hl(r), ref, `${c.primary} ${h}/${w}`);
      Z.frame(S, base({ heightIn: h, weightLb: w }), r.reads[0], { grade: 10 });
    }
  }
});

test("blank height or weight hides the panel", () => {
  const r = L.evaluate(data, base({ primary: "CF", metrics: { maxEv: 94 } })).reads[0];
  assert.equal(Z.frame(S, base({ heightIn: null }), r), null);
  assert.equal(Z.frame(S, base({ weightLb: null }), r), null);
  assert.equal(Z.frame(S, base({ heightIn: null, weightLb: null }), r), null);
  assert.ok(Z.frame(S, base({}), r));
});

test("RHP and LHP use the college pitcher rows; position players use position rows", () => {
  for (const t of ["R", "L"]) {
    const i = base({ primary: "P", throws: t, heightIn: 76, weightLb: 215, metrics: { maxFb: 86 } });
    const f = Z.frame(S, i, L.evaluate(data, i).reads[0]);
    assert.equal(f.group, "pitchers");
    for (const row of f.rows) assert.equal(row.college.height_in, S.college_roster_sample.levels[row.level].pitchers.height_in);
    assert.equal(f.rows[0].collegeText, `6'2.9", 209`);
  }
  const ss = base({ primary: "SS", heightIn: 70, weightLb: 170 });
  const fs2 = Z.frame(S, ss, L.evaluate(data, ss).reads[0]);
  assert.equal(fs2.group, "position"); assert.equal(fs2.rows[0].collegeText, `6'1.3", 204`);
  const tw = base({ primary: "SS", secondary: "P", metrics: { maxFb: 86, maxEv: 90 } });
  const reads = L.evaluate(data, tw).reads;
  assert.deepEqual(reads.map(r => Z.frame(S, tw, r).group), ["position", "pitchers"]);
});

test("JUCO weight carries the one-team note", () => {
  const f = Z.frame(S, base({}), L.evaluate(data, base({})).reads[0]);
  const j = f.rows.find(r => r.level === "JUCO");
  assert.ok(j.oneTeam && /\*$/.test(j.collegeText) && /one team \(Jones College\)/.test(j.oneTeamNote));
  assert.ok(f.rows.filter(r => r.level !== "JUCO").every(r => !r.oneTeam));
});

test("committed HS column: Slammers for everyone, Flatground for outfielders; FG D1 tiers not mapped", () => {
  const ss = Z.frame(S, base({}), L.evaluate(data, base({})).reads[0]);
  assert.equal(ss.rows.find(r => r.level === "Power 4").hsText, `6'1.8", 179`);
  assert.equal(ss.rows.find(r => r.level === "Lower D1").hsText, "Not published");
  assert.ok(!ss.fgD1);
  const cf = base({ primary: "CF" });
  const f = Z.frame(S, cf, L.evaluate(data, cf).reads[0]);
  assert.match(f.rows.find(r => r.level === "D2").hsText, /5'11.9", 174 \(all\) · 5'11.6", 178 \(OF\)/);
  assert.deepEqual(f.fgD1.map(t => t.tier), ["D1 (Top 100)", "D1 (Mid Tier)", "D1 (Lower Tier)"]);
  assert.ok(!f.rows.find(r => r.level === "Power 4").hs.some(x => x.src === "FG"));
  assert.ok(!JSON.stringify(f).includes("PBR_WI_E") && !JSON.stringify(f).includes("Wisconsin"));
});

test("headline is chosen by the data, never 'too small' or 'too big'; note always present", () => {
  const H = (h, w, pos, t) => { const i = base({ primary: pos, throws: t || "R", heightIn: h, weightLb: w, metrics: pos === "P" ? { maxFb: 86 } : {} }); return Z.frame(S, i, L.evaluate(data, i).reads[0]); };
  assert.equal(H(72, 180, "CF").headline, "At 6'0\", 180 you're right around the Mid-major D1–JUCO roster average for a position player. Power 4 position players run about 1 inch taller; the biggest size gap between levels is among pitchers.");
  assert.match(H(70, 170, "SS").headline, /^At 5'10", 170 you're about 2 inches under the average college position player below Power 4\./);
  assert.equal(H(75, 205, "P").headline, "At 6'3\", 205 you're right around the Power 4 roster average for a pitcher.");
  assert.equal(H(76, 215, "P").headline, "At 6'4\", 215 you're taller than the average college pitcher at every level, Power 4 included.");
  for (let h = 60; h <= 82; h++) for (const pos of ["SS", "CF", "P", "C"]) {
    const f = H(h, 150 + (h - 60) * 4, pos);
    assert.ok(!/too (small|big|short|tall)|undersized/i.test(f.headline), f.headline);
    assert.equal(f.note, "College averages come from listed roster heights and weights of players aged 18–23. They show the bodies players grow into, not a requirement. About 1 in 3 college players below Power 4 is under 6'0\".");
  }
});

test("sophomore pitchers get the PBR Indiana height fact; others don't", () => {
  const i = base({ primary: "P", gradYear: 2028, heightIn: 75, weightLb: 190, metrics: { maxFb: 86 }, meta: { grade: "10" } });
  const r = L.evaluate(data, i).reads[0];
  const f = Z.frame(S, i, r, { grade: V.gradeWhenMeasured(i).grade });
  assert.match(f.pitcherFact, /57\.4% of eventual D1 pitchers who were 6'2" or taller as sophomores signed Power 4, vs 34% of shorter ones/);
  assert.match(f.pitcherFact, /velocity and spin mattered more/);
  assert.equal(Z.frame(S, i, r, { grade: 11 }).pitcherFact, null);
  const ss = base({ meta: { grade: "10" } });
  assert.equal(Z.frame(S, ss, L.evaluate(data, ss).reads[0], { grade: 10 }).pitcherFact, null);
});

test("height formatting", () => {
  assert.deepEqual([Z.ht(74.08), Z.ht(72.88), Z.ht(72), Z.ht(74.9), Z.htWhole(70), Z.htWhole(76)], [`6'2.1"`, `6'0.9"`, `6'0.0"`, `6'2.9"`, `5'10"`, `6'4"`]);
});
