// v1.2 fills: every position-player tool has a target at every level.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../estimator/logic.js");
const raw = require("../data/level-benchmarks-v1.0.json");
const fills = require("../data/level-benchmarks-v1.2-fills.json");
const data = L.withFills(raw, fills);
const S = L.S;
const base = (o) => Object.assign({ gradYear: 2027, primary: "SS", secondary: "", throws: "R", bats: "R", heightIn: 72, weightLb: 180, metrics: {}, meta: {} }, o);
const ALL = { maxFb: 88, maxEv: 92, sixty: 7.0, ifVelo: 82, ofVelo: 85, cVelo: 78, pop: 2.05 };
const POS = ["P", "C", "1B", "2B", "SS", "3B", "LF", "CF", "RF"];

test("withFills leaves the original data untouched", () => {
  assert.equal(raw.fill_records, undefined);
  assert.equal(raw.recruit_target_records.length, 88);
  assert.ok(data.sources.some(s => s.id === "TP") && data.sources.some(s => s.id === "UU"));
  assert.equal(L.withFills(raw, null), raw);
});

test("no tool at any level is left without a target", () => {
  for (const pos of POS) for (const th of pos === "P" ? ["R", "L"] : ["R"]) {
    const r = L.evaluate(data, base({ primary: pos, throws: th, metrics: ALL }));
    r.reads.forEach(rd => rd.categories.forEach(c => Object.entries(c.tools).forEach(([k, t]) => {
      assert.ok(t.status === S.MEETS || t.status === S.BELOW, `${pos} ${c.key} ${k}: ${t.status}`);
    })));
  }
});

test("published main-source targets are never replaced", () => {
  const r = L.evaluate(data, base({ primary: "SS", metrics: { maxEv: 90, sixty: 6.85 } }));
  const p4 = r.reads[0].categories.find(c => c.key === "p4");
  assert.equal(p4.tools.hitting.rowId, "target_015");
  assert.equal(p4.tools.running.rowId, "target_039");
  assert.ok(!p4.tools.hitting.fill && !p4.tools.running.fill);
});

test("every estimate says how it was made; published fills are not called estimates", () => {
  fills.fill_records.forEach(f => {
    if (f.source_id === "EST") assert.ok(f.estimate_method && f.estimate_method.length > 20, f.id);
    else assert.equal(f.estimate_method, null, f.id);
    assert.ok(data.sources.some(s => s.id === f.source_id), `${f.id} source ${f.source_id} is listed`);
  });
  const r = L.evaluate(data, base({ primary: "SS", metrics: { maxEv: 87 } }));
  const low = r.reads[0].categories.find(c => c.key === "low").tools.hitting;
  assert.equal(low.estimated, true);
  assert.equal(low.threshold, 86.5);
  assert.ok(/Mid-major D1 \(88 mph\) and D2 \(85 mph\)/.test(low.estimateMethod));
});

test("the three D1 targets are never easier than D2 for the same tool", () => {
  const thr = (pos, key, tool) => {
    const r = L.evaluate(data, base({ primary: pos, metrics: ALL }));
    const t = r.reads[0].categories.find(c => c.key === key).tools[tool];
    return { v: t.threshold, higher: t.direction === "higher_is_better" };
  };
  for (const pos of POS.filter(p => p !== "P")) for (const tool of ["hitting", "running", "throwing"]) {
    const [a, b, c, d] = ["p4", "mid", "low", "d2"].map(k => thr(pos, k, tool));
    const ok = (x, y) => a.higher ? x.v >= y.v : x.v <= y.v;
    assert.ok(ok(a, b) && ok(b, c) && ok(c, d), `${pos} ${tool}: ${a.v} ${b.v} ${c.v} ${d.v}`);
  }
});

test("faster or stronger never hurts with fill targets", () => {
  for (const pos of ["1B", "3B", "SS", "CF", "C"]) {
    const slow = L.evaluate(data, base({ primary: pos, metrics: { sixty: 7.6, ifVelo: 74, ofVelo: 74, pop: 2.2, maxEv: 80 } }));
    const fast = L.evaluate(data, base({ primary: pos, metrics: { sixty: 6.6, ifVelo: 92, ofVelo: 92, pop: 1.85, maxEv: 100 } }));
    fast.reads[0].categories.forEach((c, i) => Object.keys(c.tools).forEach(k => {
      if (slow.reads[0].categories[i].tools[k].status === S.MEETS) assert.equal(c.tools[k].status, S.MEETS, `${pos} ${c.key} ${k}`);
    }));
  }
});
