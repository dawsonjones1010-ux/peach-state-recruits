// v42 scoring engine v3: shared core, pitcher and position rules.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const C = require("../estimator/fit-core.js");
const P = require("../estimator/pitcher.js");
const F = require("../estimator/position.js");
const L = require("../estimator/logic.js");
const PG = require("../estimator/progress.js");
const R = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", f), "utf8"));
const data = L.withFills(R("level-benchmarks-v1.0.json"), R("level-benchmarks-v1.2-fills.json"));
const run = (pos, metrics, extra) => { const input = Object.assign({ primary: pos, throws: "R", metrics, meta: {}, methods: {} }, extra || {}); return F.evaluate(L.positionRead(data, input, pos), input); };
const recent = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
const lvl = (f, k) => f.levels.find(l => l.key === k);

test("1. all v3 weights live in one config and sum to 100 per level/position", () => {
  Object.entries(C.CONFIG.pitcher.weights).forEach(([k, w]) => assert.equal(w.velocity + w.command + w.secondary + w.characteristics + w.performance, 100, k));
  Object.entries(C.CONFIG.position.weights).forEach(([k, w]) => assert.equal(w.hitting + w.defense + w.speed + w.performance, 100, k));
  assert.equal(C.CONFIG.pitcher.weights.juco.provisional, true);
});

test("2. velocity is sitting 75% + peak 25%", () => {
  const l = lvl(P.evaluate({ throws: "R", metrics: { typFb: 86, maxFb: 94 } }), "mid"); // sit 75 at min, peak 100 at top
  assert.ok(Math.abs(l.cats.velocity - (75 * 0.75 + 100 * 0.25)) < 1e-9);
});

test("3. peak only is scored but incomplete; sitting is never derived from peak", () => {
  const f = P.evaluate({ throws: "R", metrics: { maxFb: 92 } });
  assert.equal(f.derived.sit, null);
  assert.match(lvl(f, "mid").veloNote, /Incomplete/);
  assert.ok(f.confidence.incomplete && f.confidence.score <= C.CONFIG.confidence.incompleteCap);
  assert.equal(f.priorities[0].key, "sit");
});

test("4. sitting shortfall adjustment follows the configured table", () => {
  assert.deepEqual([0, 1, 1.5, 2, 2.5, 3, 4, 5, 5.5].map(P.penaltyFor), [0, 0, 3, 3, 7, 7, 12, 12, 18]);
  const l = lvl(P.evaluate({ throws: "R", metrics: { typFb: 82 } }), "mid"); // 4 mph short of 86
  assert.equal(l.adjustments[0].points, -12);
  assert.ok(Math.abs(l.score - Math.max(0, l.base - 12)) < 1e-9);
});

test("5. scores are clamped 0-100, kept unrounded internally and rounded for display", () => {
  const f = P.evaluate({ throws: "R", metrics: { typFb: 60, maxFb: 62 } });
  f.levels.forEach(l => { assert.ok(l.score >= 0 && l.score <= 100); assert.equal(l.display, Math.round(l.score)); });
  const g = P.evaluate({ throws: "R", metrics: { typFb: 87.3, maxFb: 90 } });
  assert.notEqual(lvl(g, "mid").score, Math.round(lvl(g, "mid").score));
});

test("6. command normalizes over what's entered; FPS% and zone% are shown, not scored", () => {
  const a = P.evaluate({ throws: "R", metrics: { typFb: 88, strikePct: 65 } });
  const b = P.evaluate({ throws: "R", metrics: { typFb: 88, strikePct: 65, fpsPct: 20, zonePct: 10 } });
  assert.equal(lvl(a, "mid").cats.command, 100);
  assert.deepEqual(a.levels.map(l => l.score), b.levels.map(l => l.score));
  assert.equal(b.info.fpsPct, 20);
});

test("7. performance uses ERA, WHIP and K/9 only (BB/9 isn't counted twice)", () => {
  const l = lvl(P.evaluate({ throws: "R", metrics: { typFb: 88, bb9: 6 } }), "mid");
  assert.equal(l.cats.performance, null);
  assert.ok(l.cats.command < 100);
});

test("8. missing advanced data never lowers a score", () => {
  const base = { typFb: 88, maxFb: 91, strikePct: 64 };
  const a = P.evaluate({ throws: "R", metrics: base });
  const b = P.evaluate({ throws: "R", metrics: Object.assign({}, base, { fbSpin: 1700, ivb: 10, bbType: "Slider", bbVelo: 70 }) });
  assert.deepEqual(a.levels.map(l => l.score), b.levels.map(l => l.score));
  assert.equal(b.info.secondary[0].type, "Slider");
});

test("9. zero innings never divides by zero", () => {
  const f = P.evaluate({ throws: "R", metrics: { typFb: 85, ip: 0, so: 3, bb: 1 } });
  assert.equal(f.derived.k9, null); assert.equal(f.derived.bb9, null);
  assert.ok(f.levels.every(l => l.score == null || isFinite(l.score)));
});

test("10. classification labels", () => {
  assert.deepEqual([95, 89.6, 85, 79.4, 65, 59.4, null].map(C.classify),
    ["Strong benchmark fit", "Strong benchmark fit", "Competitive benchmark fit", "Developing benchmark fit", "Below typical benchmark fit", "Significant benchmark gaps", "Incomplete evaluation"]);
});

test("11. no level at 85 with core met → 'Further evaluation needed' plus the closest category", () => {
  const f = P.evaluate({ throws: "R", metrics: { typFb: 72, maxFb: 75 } });
  assert.equal(f.primary, null);
  assert.ok(f.closest);
  assert.equal(f.primaryScore, lvl(f, f.closest).display);
});

test("12. stretch needs 65+, plausibility and a real gap; otherwise it says why", () => {
  const sel = C.selectTargets([
    { key: "p4", score: 60, coreOk: false, plausible: true, hasGap: true },
    { key: "mid", score: 90, coreOk: true, plausible: true, hasGap: false }
  ], { sufficient: true });
  assert.equal(sel.primary, "mid"); assert.equal(sel.stretch, null); assert.match(sel.stretchReason, /Not established/);
  const ok = C.selectTargets([{ key: "p4", score: 70, coreOk: false, plausible: true, hasGap: true }, { key: "mid", score: 90, coreOk: true, plausible: true, hasGap: false }], { sufficient: true });
  assert.equal(ok.stretch, "p4");
  const far = C.selectTargets([{ key: "p4", score: 70, coreOk: false, plausible: false, hasGap: true }, { key: "mid", score: 90, coreOk: true, plausible: true, hasGap: false }], { sufficient: true });
  assert.equal(far.stretch, null);
});

test("13. additional opportunities are other ladder levels at 80+; JUCO is reported separately", () => {
  const f = P.evaluate({ throws: "R", metrics: { typFb: 88, maxFb: 91, strikePct: 65 } });
  f.also.forEach(k => assert.ok(lvl(f, k).display >= 80));
  assert.ok(!f.also.includes("juco") && !f.also.includes(f.primary) && !f.also.includes(f.stretch));
});

test("14. ties are deterministic: the higher category is the target and the tie is reported", () => {
  const lv = (key, score) => ({ key, score, coreOk: true, plausible: true, hasGap: true });
  const sel = C.selectTargets([lv("d2", 70), lv("d3", 70), lv("naia", 70)], { sufficient: true });
  assert.equal(sel.closest, "d2"); assert.deepEqual(sel.ties, ["d3", "naia"]);
});

test("15. confidence = .3 completeness + .3 verification + .2 recency + .2 sample, with labels", () => {
  const c = C.confidenceIndex({ completeness: 100, verification: 85, recency: 100, sample: 75 });
  assert.equal(c.score, Math.round(30 + 25.5 + 20 + 15)); assert.equal(c.label, "High");
  assert.equal(C.confidenceLabel(70), "Moderate"); assert.equal(C.confidenceLabel(50), "Limited"); assert.equal(C.confidenceLabel(20), "Insufficient");
});

test("16. verification needs a link; recency and sample bands", () => {
  assert.equal(C.verificationValue({ meta: { source: "event", link: "https://x.com/r" } }).value, 100);
  assert.equal(C.verificationValue({ meta: { source: "event" } }).value, 85);
  assert.equal(C.verificationValue({ meta: { source: "self", method: "radar" } }).value, 70);
  assert.equal(C.verificationValue({ meta: { source: "self" }, methods: {} }, { handTimed: true }).value, 50);
  assert.equal(C.verificationValue({ meta: {} }).value, 30);
  const now = new Date("2026-11-23T12:00:00");
  assert.deepEqual(["2026-10-01", "2026-07-01", "2026-01-15", "2025-01-01"].map(d => C.recencyValue(d, now).value), [100, 85, 65, 35]);
  assert.deepEqual([10, 40, 100, 200].map(n => C.sampleValue("pa", n).value), [20, 50, 75, 100]);
});

test("17. insufficient confidence makes the primary provisional, not hidden", () => {
  const f = P.evaluate({ throws: "R", metrics: { maxFb: 95 }, meta: {} });
  assert.equal(f.confidence.label, "Insufficient");
  assert.equal(f.provisional, true);
});

test("18. standout tools need a Power 4 benchmark and never add points", () => {
  const f = P.evaluate({ throws: "R", metrics: { typFb: 91, maxFb: 94 } });
  assert.equal(f.standouts[0].tool, "Fastball Velocity");
  assert.equal(P.evaluate({ throws: "R", metrics: { typFb: 88 } }).standouts.length, 0);
  const pos = run("CF", { maxEv: 96, sixty: 6.5, ofVelo: 90 });
  assert.ok(pos.standouts.length >= 2);
});

test("19. position v3: limited assessment, stats only affect confidence, no weakest-tool multiplier", () => {
  const a = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85 });
  const b = run("SS", { maxEv: 92, sixty: 6.9, ifVelo: 85, avg: .41, obp: .5, slg: .7, pa: 160, hk: 20, hbb: 30 }, { meta: { date: recent } });
  assert.deepEqual(a.levels.map(l => l.score), b.levels.map(l => l.score));
  assert.ok(b.confidence.score > a.confidence.score);
  assert.equal(b.stats.ops, 1.2); assert.equal(b.stats.kPct, 12.5);
  assert.equal(a.categories.find(c => c.key === "hitting").limited, true);
  const l = lvl(a, "p4"), w = F.WEIGHTS.SS, s = l.cats;
  const expect = (s.hitting * w.hitting + s.defense * w.defense + s.speed * w.speed) / (w.hitting + w.defense + w.speed);
  assert.ok(Math.abs(l.score - expect) < 1e-9);
});

test("20. development outlook: insufficient with fewer than two dated points, trend otherwise", () => {
  assert.equal(C.trend([{ t: "2026-01-01T00:00:00Z", metrics: { typFb: 84 } }], "typFb").enough, false);
  const h = [{ t: "2026-05-01T00:00:00Z", metrics: { typFb: 84 } }, { t: "2026-09-01T00:00:00Z", metrics: { typFb: 86 } }];
  const t = C.trend(h, "typFb");
  assert.equal(t.enough, true); assert.equal(t.change, 2); assert.equal(t.direction, "improving");
  const sixty = C.trend([{ t: "2026-05-01T00:00:00Z", metrics: { sixty: 7.0 } }, { t: "2026-09-01T00:00:00Z", metrics: { sixty: 6.8 } }], "sixty", true);
  assert.equal(sixty.direction, "improving");
});

test("history stores model and benchmark versions and stays append-only", () => {
  const mem = {}, store = { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const e1 = PG.entryFrom({ primary: "P", metrics: { typFb: 84 }, meta: { date: "2026-05-01" } }, [], new Date("2026-05-02"), { model: C.MODEL_VERSION, benchmarks: "x" });
  const e2 = PG.entryFrom({ primary: "P", metrics: { typFb: 86 }, meta: { date: "2026-09-01" } }, [], new Date("2026-09-02"), { model: C.MODEL_VERSION, benchmarks: "x" });
  PG.save(store, e1); const h = PG.save(store, e2);
  assert.equal(h.length, 2); assert.equal(h[0].metrics.typFb, 84); assert.equal(h[1].model, "3.0.0"); assert.equal(h[1].measured, "2026-09-01");
});

test("a published benchmark is never changed by v3", () => {
  assert.deepEqual(P.VELO.R.sit.p4, [90, 94]); assert.deepEqual(P.VELO.L.peak.d3, [77, 85]);
  assert.equal(P.PERF.era.t.mid, 2.5); assert.equal(P.PERF.strikePct.t.d2, 62); assert.equal(P.PERF.k9.t.juco, null);
});
