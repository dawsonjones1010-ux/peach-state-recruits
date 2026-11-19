// Tests for the v13 presentation summary (headline, next step, level statuses).
const test = require("node:test"), assert = require("node:assert");
const L = require("../estimator/logic.js"), U = require("../estimator/summary.js"), data = require("../data/level-benchmarks-v1.0.json");
const run = (o) => L.evaluate(data, Object.assign({ gradYear: 2027, throws: "R", bats: "R", secondary: "", meta: {} }, o));
const row = (rd) => U.levels(rd).map(l => `${l.label}: ${l.status}`).join("|");

test("CF 94 / 6.75 / 88: headline, next step, level row", () => {
  const rd = run({ primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } }).reads[0];
  assert.equal(U.title(rd), "Your results as a center fielder.");
  assert.equal(U.headline(rd).text, "Your numbers meet the listed mid-major D1 targets.");
  assert.equal(U.headline(rd).support, "Supported by your max exit velocity (94 mph) and 60-yard dash (6.75 s).");
  assert.equal(U.nextStep(rd).text, "Next benchmark: Power conference D1. Your 60 is 0.05 s slower than the listed 6.70 s.");
  assert.equal(row(rd), "Power D1: Close|Mid-major D1: Meets targets|Lower D1: No published target|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets");
});

test("SS/P two-way: separate summaries, never blended", () => {
  const r = run({ primary: "SS", secondary: "P", metrics: { maxFb: 86, maxEv: 90, sixty: 6.9, ifVelo: 84 } });
  const [ss, p] = r.reads;
  assert.deepEqual([U.tabLabel(ss), U.tabLabel(p)], ["Shortstop", "Pitcher"]);
  assert.equal(U.headline(ss).text, "Your numbers meet the listed mid-major D1 targets.");
  assert.equal(U.nextStep(ss).text, "Next benchmark: Power conference D1. Your exit velocity is 1 mph short of the listed 91 mph. One other number is also below this target.");
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
  assert.equal(U.headline(low).text, "Your numbers don't fully meet any level's listed targets yet.");
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
