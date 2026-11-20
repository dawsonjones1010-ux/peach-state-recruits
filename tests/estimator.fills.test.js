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

// ---- v26 "What moves you up" ----
const U = require("../estimator/summary.js");
const mv = (o) => U.movesUp(L.evaluate(data, base(o)).reads[0]);

test("what moves you up: one change names the highest level it reaches", () => {
  const cf = mv({ primary: "CF", metrics: { maxEv: 94, sixty: 6.75, ofVelo: 88 } });
  assert.equal(cf.text, "Run a 6.70 or faster 60 to reach the listed Power conference D1 targets.");
  assert.equal(cf.next.steps[0].change, "0.05 s faster");
  const ss = mv({ primary: "SS", metrics: { maxEv: 90, sixty: 6.9, ifVelo: 84 } });
  assert.equal(ss.next.level, "mid", "86 mph clears Lower and Mid-major D1 together");
  assert.equal(ss.text, "Throw 86 mph across the infield to reach the listed Mid-major D1 targets.");
});

test("what moves you up: several changes are all listed; top level and missing metrics are handled", () => {
  const c = mv({ primary: "C", metrics: { maxEv: 84, sixty: 7.6, pop: 2.12 } });
  assert.equal(c.next.steps.length, 2);
  assert.ok(/^To reach D2: run a 7.50 or faster 60 and pop 2.10 or faster to second\.$/.test(c.text), c.text);
  const top = mv({ primary: "SS", metrics: { maxEv: 93, sixty: 6.8, ifVelo: 86 } });
  assert.equal(top.top, true);
  const thin = mv({ primary: "SS", metrics: { maxEv: 88 } });
  assert.equal(thin.next, null);
  assert.ok(/Add your 60-yard dash and throw/.test(thin.text));
  const p = mv({ primary: "P", metrics: { maxFb: 86 } });
  assert.equal(p.text, "Get your fastball to 88 mph to reach the listed Mid-major D1 targets.");
  assert.equal(p.jump, null, "pitchers get no 'one change goes further' line");
});

test("what moves you up: following the advice really reaches that level", () => {
  const cases = [["CF", { maxEv: 94, sixty: 6.75, ofVelo: 88 }], ["SS", { maxEv: 84, sixty: 7.0, ifVelo: 80 }], ["C", { maxEv: 84, sixty: 7.6, pop: 2.12 }], ["1B", { maxEv: 86, sixty: 7.4, ifVelo: 70 }], ["LF", { maxEv: 92, sixty: 7.05, ofVelo: 90 }]];
  const KEY = { hitting: "maxEv", running: "sixty", pitching: "maxFb" };
  for (const [pos, m] of cases) {
    const r = L.evaluate(data, base({ primary: pos, metrics: m })).reads[0], res = U.movesUp(r);
    if (!res.next) continue;
    const m2 = Object.assign({}, m);
    res.next.steps.forEach(s => { const k = KEY[s.tool] || (pos === "C" ? "pop" : /F$/.test(pos) ? "ofVelo" : "ifVelo"); m2[k] = s.threshold; });
    const after = L.evaluate(data, base({ primary: pos, metrics: m2 })).reads[0];
    assert.ok(after.categories.find(c => c.key === res.next.level).highlighted, `${pos}: ${res.text}`);
  }
});

// ---- v28 schools at the headline level and below (CLOSE is not a match) ----
const at = (o) => U.schoolsAtLevel(L.evaluate(data, base(o)).reads[0]);

test("schools at your level: D2 headline does not include Power, mid-major or NCAA D1", () => {
  const s = at({ primary: "C", metrics: { maxEv: 85, sixty: 7.30, cVelo: 74, pop: 2.10 } });
  assert.equal(s.atLevel, true);
  assert.equal(s.top, "d2");
  assert.deepEqual(s.filters, ["NCAA D2", "NCAA D3", "NAIA", "JUCO"]);
  assert.deepEqual(s.labels, ["D2 and below"]);
  assert.ok(!s.filters.includes("NCAA D1") && !s.labels.some(x => /Power|Mid-major/i.test(x)));
});

test("schools at your level: CLOSE to a higher tier is not treated as a match", () => {
  const s = at({ primary: "SS", metrics: { maxEv: 90, sixty: 6.9, ifVelo: 84 } });
  assert.equal(s.top, "d2");
  assert.ok(!s.filters.includes("NCAA D1"), "mid-major CLOSE must not add NCAA D1");
});

test("schools at your level: Lower D1 names that tier, not Power or mid-major", () => {
  const s = at({ primary: "C", metrics: { maxEv: 85, sixty: 7.30, cVelo: 74, pop: 2.05 } });
  assert.equal(s.top, "low");
  assert.deepEqual(s.filters, ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO"]);
  assert.deepEqual(s.labels, ["Lower D1 and below"]);
  assert.ok(!s.labels.some(x => /Power|Mid-major/i.test(x)));
});

test("schools at your level: Power D1 includes every finder level; no headline explores every level", () => {
  const top = at({ primary: "SS", metrics: { maxEv: 93, sixty: 6.8, ifVelo: 86 } });
  assert.equal(top.top, "p4");
  assert.deepEqual(top.filters, ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO"]);
  assert.deepEqual(top.labels, ["Power D1 and below"]);
  const none = at({ primary: "SS", metrics: { maxEv: 88 } });
  assert.equal(none.atLevel, false);
  assert.deepEqual(none.filters, []);
  assert.deepEqual(none.labels, []);
});

