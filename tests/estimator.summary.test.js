// Tests for the v13 presentation summary (headline, next step, level statuses).
const test = require("node:test"), assert = require("node:assert");
const L = require("../estimator/logic.js"), U = require("../estimator/summary.js"), data = require("../data/level-benchmarks-v1.0.json");
const run = (o) => L.evaluate(data, Object.assign({ gradYear: 2027, throws: "R", bats: "R", secondary: "", heightIn: 72, weightLb: 180, meta: {} }, o));
const row = (rd) => U.levels(rd).map(l => `${l.label}: ${l.status}`).join("|");

test("CF 94 / 6.75 / 88: headline, next step, level row", () => {
  const rd = run({ primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } }).reads[0];
  assert.equal(U.title(rd), "Your results as a center fielder.");
  assert.equal(U.headline(rd).text, "Your metrics meet the listed mid-major D1 targets.");
  assert.equal(U.headline(rd).support, "Supported by your max exit velocity (94 mph) and 60-yard dash (6.75 s).");
  assert.equal(U.nextStep(rd).text, "Next benchmark: Power conference D1. Your 60 is 0.05 s slower than the listed 6.70 s.");
  assert.equal(row(rd), "Power D1: Close|Mid-major D1: Meets targets|Lower D1: No published target|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets");
});

test("SS/P two-way: separate summaries, never blended", () => {
  const r = run({ primary: "SS", secondary: "P", metrics: { maxFb: 86, maxEv: 90, sixty: 6.9, ifVelo: 84 } });
  const [ss, p] = r.reads;
  assert.deepEqual([U.tabLabel(ss), U.tabLabel(p)], ["Shortstop", "Pitcher"]);
  assert.equal(U.headline(ss).text, "Your metrics meet the listed mid-major D1 targets.");
  assert.equal(U.nextStep(ss).text, "Next benchmark: Power conference D1. Your exit velocity is 1 mph short of the listed 91 mph. One other metric is also below this target.");
  assert.equal(U.headline(p).text, "Your fastball meets the listed lower D1 velocity target.");
  assert.equal(U.nextStep(p).text, "Next benchmark: Mid-major D1. Your fastball is 2 mph short of the listed 88 mph.");
  assert.equal(row(p), "Power D1: Below targets|Mid-major D1: Below targets|Lower D1: Meets targets|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets");
});

test("Every level always listed, in order; Meets targets == existing highlight rule", () => {
  for (const o of [{ primary: "C", metrics: { maxEv: 80, sixty: 7.6, cVelo: 70, pop: 2.2 } }, { primary: "1B", metrics: { maxEv: 100, sixty: 6.6, ifVelo: 88 } }, { primary: "P", metrics: { maxFb: 90 } }, { primary: "LF", metrics: {} }]) {
    for (const rd of run(o).reads) {
      const lv = U.levels(rd);
      assert.deepEqual(lv.map(l => l.label), ["Power D1", "Mid-major D1", "Lower D1", "D2", "D3", "NAIA", "JUCO"]);
      assert.deepEqual(lv.filter(l => l.status === U.ST.MEETS).map(l => l.key), rd.highlight.categories);
    }
  }
});

test("Fallbacks: no level met, or more info needed", () => {
  const fb = run({ primary: "1B", metrics: { maxEv: 100, sixty: 6.6, ifVelo: 88 } }).reads[0];
  assert.equal(U.headline(fb).text, "More information needed for an overall range.");
  assert.equal(U.levels(fb).filter(l => l.status === U.ST.NEED).length, 6);
  const low = run({ primary: "SS", metrics: { maxEv: 70, sixty: 8.2, ifVelo: 65 } }).reads[0];
  assert.equal(U.headline(low).text, "Your metrics don't fully meet any level's listed targets yet.");
  assert.ok(/^Next benchmark: /.test(U.nextStep(low).text));
  const none = run({ primary: "P", throws: "L", metrics: {} }).reads[0];
  assert.equal(U.headline(none).text, "More information needed for an overall range.");
  assert.equal(U.nextStep(none), null);
});

test("deSource keeps source names out of main-view strings", () => {
  const r = run({ primary: "1B", metrics: { maxEv: 95, sixty: 7.0, ifVelo: 85 } });
  const strs = r.reads.flatMap(rd => rd.highlight.explain.concat(rd.categories.flatMap(c => Object.values(c.tools).map(t => t.reason || ""))));
  for (const s of strs) assert.ok(!/NextCommit|NCSA|BaseballPath|Flatground|Slammers/.test(U.deSource(s)), s);
});

const fills = require("../data/level-benchmarks-v1.2-fills.json");
const full = L.withFills(data, fills);
const runFilled = (o) => L.evaluate(full, Object.assign({ gradYear: 2027, throws: "R", bats: "R", secondary: "", heightIn: 72, weightLb: 180, meta: {} }, o));
const pctRow = (rd) => U.matchShare(rd).levels.map(l => l.show ? `${l.label}: ${l.pct}% (${l.met} of ${l.of})` : `${l.label}: ${l.reason}`).join("|");

test("match share uses existing targets: CF 94 / 6.75 / 88 with fills", () => {
  const rd = runFilled({ primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } }).reads[0];
  const m = U.matchShare(rd);
  assert.equal(m.enough, true);
  assert.equal(m.minTools, 2);
  assert.equal(pctRow(rd), "Power D1: 67% (2 of 3)|Mid-major D1: 100% (3 of 3)|Lower D1: 100% (3 of 3)|D2: 100% (3 of 3)|D3: 100% (3 of 3)|NAIA: 100% (3 of 3)|JUCO: 100% (3 of 3)");
  assert.match(m.disclaimer, /aren't a guarantee of recruitment/);
  // Headline / highlight is unchanged by the percentage (Power D1 is 67% / Close, Mid-major still headlines).
  assert.equal(U.headline(rd).level, "mid");
  assert.equal(rd.categories.find(c => c.key === "p4").highlighted, false);
  assert.equal(rd.categories.find(c => c.key === "mid").highlighted, true);
});

test("match share without fills does not invent missing throwing targets", () => {
  const rd = run({ primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } }).reads[0];
  assert.equal(pctRow(rd), "Power D1: 50% (1 of 2)|Mid-major D1: 100% (2 of 2)|Lower D1: no-target|D2: 100% (2 of 2)|D3: 100% (2 of 2)|NAIA: 100% (2 of 2)|JUCO: 100% (2 of 2)");
});

test("height and weight never change the match percentage", () => {
  const metrics = { maxEv: 94, sixty: 6.75, ofVelo: 88 };
  const a = U.matchShare(runFilled({ primary: "CF", heightIn: 64, weightLb: 130, metrics }).reads[0]);
  const b = U.matchShare(runFilled({ primary: "CF", heightIn: 76, weightLb: 210, metrics }).reads[0]);
  const c = U.matchShare(runFilled({ primary: "CF", heightIn: 72, weightLb: 180, metrics, meta: { source: "self" } }).reads[0]);
  assert.deepEqual(a.levels, b.levels);
  assert.deepEqual(a.levels, c.levels);
});

test("grad year does not invent new benchmarks or change the match percentage", () => {
  const metrics = { maxEv: 94, sixty: 6.75, ofVelo: 88 };
  const a = U.matchShare(runFilled({ primary: "CF", gradYear: 2028, metrics }).reads[0]);
  const b = U.matchShare(runFilled({ primary: "CF", gradYear: 2031, metrics }).reads[0]);
  assert.deepEqual(a.levels, b.levels);
});

test("average EV, 30-yard and unused stats are not counted in the match percentage", () => {
  const baseM = { maxEv: 94, sixty: 6.75, ofVelo: 88 };
  const a = U.matchShare(runFilled({ primary: "CF", metrics: baseM }).reads[0]);
  const b = U.matchShare(runFilled({ primary: "CF", metrics: Object.assign({ avgEv: 88, thirty: 3.9, avg: .400, slg: .600, batSpeed: 70 }, baseM) }).reads[0]);
  assert.deepEqual(a.levels, b.levels);
  assert.equal(a.levels.find(l => l.key === "mid").of, 3);
});

test("too few entered metrics: no misleading percentage", () => {
  const one = U.matchShare(runFilled({ primary: "CF", metrics: { maxEv: 94 } }).reads[0]);
  assert.equal(one.enough, false);
  assert.ok(one.levels.every(l => l.show === false && l.reason === "not-enough"));
  assert.match(one.message, /Not enough metrics were entered to estimate a match percentage/);
  assert.match(one.message, /at least 2/);

  const emptyP = U.matchShare(runFilled({ primary: "P", metrics: {} }).reads[0]);
  assert.equal(emptyP.enough, false);
  assert.match(emptyP.message, /fastball/);

  const p = U.matchShare(runFilled({ primary: "P", metrics: { maxFb: 90 } }).reads[0]);
  assert.equal(p.enough, true);
  assert.equal(p.minTools, 1);
  assert.equal(pctRow(runFilled({ primary: "P", metrics: { maxFb: 90 } }).reads[0]), "Power D1: 0% (0 of 1)|Mid-major D1: 100% (1 of 1)|Lower D1: 100% (1 of 1)|D2: 100% (1 of 1)|D3: 100% (1 of 1)|NAIA: 100% (1 of 1)|JUCO: 100% (1 of 1)");
});
