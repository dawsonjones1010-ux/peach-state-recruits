// v41 position-player evaluation engine (published targets, per-position model).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const L = require("../estimator/logic.js");
const F = require("../estimator/position.js");
const R = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", f), "utf8"));
const data = L.withFills(R("level-benchmarks-v1.0.json"), R("level-benchmarks-v1.2-fills.json"));
const run = (pos, metrics, extra) => { const input = Object.assign({ primary: pos, throws: "R", metrics, meta: {}, methods: {} }, extra || {}); return F.evaluate(L.positionRead(data, input, pos), input); };

test("meeting a target exactly scores 85, each step better adds 5, each step short costs 10", () => {
  assert.equal(F.metricScore({ value: 88, threshold: 88, direction: "higher_is_better", unit: "mph" }), 85);
  assert.equal(F.metricScore({ value: 90, threshold: 88, direction: "higher_is_better", unit: "mph" }), 95);
  assert.equal(F.metricScore({ value: 6.9, threshold: 6.8, direction: "lower_is_better", unit: "seconds", metric: "60-yard dash" }), 75);
  assert.equal(F.metricScore({ value: 2.1, threshold: 2.05, direction: "lower_is_better", unit: "seconds", metric: "Pop time to 2B" }), 75);
});

test("a CF with 94 / 6.75 / 88 is a mid-major primary target with Power 4 as the stretch", () => {
  const f = run("CF", { maxEv: 94, sixty: 6.75, ofVelo: 88 });
  assert.equal(f.primary, "mid");
  assert.equal(f.stretch, "p4");
  assert.ok(f.levels.find(l => l.key === "p4").score < F.STRONG);
  assert.equal(f.priorities[0].tool, "running");
});

test("fewer than two tools means no score, never a zero", () => {
  const f = run("2B", { maxEv: 90 });
  assert.equal(f.enough, false);
  assert.ok(f.levels.every(l => l.score == null));
});

test("positions weigh tools differently: speed matters more for a CF than a 1B", () => {
  const cf = run("CF", { maxEv: 93, sixty: 7.3, ofVelo: 87 });
  const lf = run("LF", { maxEv: 93, sixty: 7.3, ofVelo: 87 });
  assert.ok(cf.levels.find(l => l.key === "p4").score < lf.levels.find(l => l.key === "p4").score);
});

test("a first baseman's 60 can lower his score but doesn't gate it", () => {
  const f = run("1B", { maxEv: 99, sixty: 7.4, ifVelo: 80 });
  assert.ok(f.levels.find(l => l.key === "low").score >= F.STRONG);
});

test("catchers are scored on pop time", () => {
  const good = run("C", { maxEv: 88, pop: 1.95 }), slow = run("C", { maxEv: 88, pop: 2.2 });
  assert.ok(good.levels.find(l => l.key === "mid").score > slow.levels.find(l => l.key === "mid").score);
});

test("game stats and projection are never scored; height and weight never count", () => {
  const a = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85, avg: .4, obp: .5, slg: .7 }, { heightIn: 74, weightLb: 200 });
  const b = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85 }, { heightIn: 66, weightLb: 150 });
  assert.deepEqual(a.levels.map(l => l.score), b.levels.map(l => l.score));
  assert.equal(a.categories.find(c => c.key === "performance").score, null);
  assert.equal(a.categories.find(c => c.key === "projection").score, null);
});

test("what-if re-scores without touching the real read", () => {
  const input = { primary: "SS", throws: "R", metrics: { maxEv: 90, sixty: 7.1, ifVelo: 84 }, meta: {}, methods: {} };
  const read = L.positionRead(data, input, "SS");
  const before = JSON.stringify(read);
  const hyp = F.evaluate(F.withValues(read, { sixty: 6.7 }), input);
  assert.equal(JSON.stringify(read), before);
  assert.ok(hyp.levels.find(l => l.key === "mid").score > F.evaluate(read, input).levels.find(l => l.key === "mid").score);
});

test("hand-timed 60s lower confidence", () => {
  const laser = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85 }, { methods: { sixty: "laser" } });
  const hand = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85 }, { methods: { sixty: "hand" } });
  assert.ok(laser.confidence.score > hand.confidence.score);
});
