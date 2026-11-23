// v40 pitcher evaluation engine (Peach State Recruits screening ranges).
const test = require("node:test");
const assert = require("node:assert");
const P = require("../estimator/pitcher.js");

const doc = { throws: "R", gradYear: 2027, metrics: { typFb: 87, maxFb: 90, era: 2.10, whip: 1.05, k9: 10.5, bb9: 2.4, strikePct: 65, repertoire: ["Four-seam fastball", "Slider"] }, meta: { source: "event", date: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }, methods: {} };

test("worked example from the standards doc lands on Low-Major D1", () => {
  const r = P.evaluate(doc, { bbVelo: 78 });
  const s = Object.fromEntries(r.levels.map(l => [l.key, l.score]));
  assert.equal(r.primary, "low");
  assert.ok(s.p4 >= 35 && s.p4 <= 50, "P4 is a long shot (" + s.p4 + ")");
  assert.ok(s.mid >= 70 && s.mid < 85, "Mid-major is possible (" + s.mid + ")");
  assert.ok(s.low >= 85, "Low-major is strong (" + s.low + ")");
  assert.ok(s.juco >= 85);
  assert.equal(r.stretch, "mid");
  assert.ok(!r.also.includes("mid"), "stretch target not repeated as an additional opportunity");
  assert.equal(r.priorities[0].key, "sit");
  assert.equal(r.priorities[0].goal, "89 mph");
});

test("left-handers are measured against the LHP ranges", () => {
  const rhp = P.evaluate({ throws: "R", metrics: { typFb: 85, maxFb: 88 } });
  const lhp = P.evaluate({ throws: "L", metrics: { typFb: 85, maxFb: 88 } });
  assert.ok(lhp.levels.find(l => l.key === "mid").score > rhp.levels.find(l => l.key === "mid").score);
});

test("no fastball means no evaluation, never a zero", () => {
  const r = P.evaluate({ throws: "R", metrics: { era: 1.5 } });
  assert.equal(r.enough, false);
  assert.ok(r.levels.every(l => l.score == null));
});

test("season totals become per-9 rates using box-score innings", () => {
  assert.equal(P.baseballInnings(45.1).toFixed(3), "45.333");
  const d = P.derive({ ip: 45.1, so: 53, bb: 12 });
  assert.equal(d.k9, 10.5); assert.equal(d.bb9, 2.4); assert.equal(d.kbb, 4.4);
});

test("JUCO performance is 'Varies' and not scored", () => {
  const r = P.evaluate(doc);
  const j = r.levels.find(l => l.key === "juco");
  assert.equal(j.cats.performance, null);
  assert.equal(j.cats.command, null);
});

test("great stats can't carry a slow fastball at a high level (velocity gate)", () => {
  const r = P.evaluate({ throws: "R", metrics: { typFb: 80, maxFb: 83, era: 0.5, whip: 0.6, k9: 15, bb9: 1, strikePct: 72 } });
  assert.ok(r.levels.find(l => l.key === "p4").score < 30);
});

test("secondary pitches, pitch shape and projection are never scored", () => {
  const r = P.evaluate(Object.assign({}, doc, { metrics: Object.assign({}, doc.metrics, { fbSpin: 2400, ivb: 18 }) }));
  ["pitchShape", "secondary", "projection"].forEach(k => assert.equal(r.categories.find(c => c.key === k).score, null));
});

test("confidence reflects completeness, not talent", () => {
  const thin = P.evaluate({ throws: "R", metrics: { maxFb: 95 }, meta: {} });
  const full = P.evaluate(doc, { bbVelo: 78 });
  assert.ok(thin.confidence.score < full.confidence.score);
  assert.ok(thin.levels.find(l => l.key === "p4").score > full.levels.find(l => l.key === "p4").score);
});

test("underclassmen get a current-not-projected note", () => {
  const c = P.classContext(2029, new Date("2026-11-23T12:00:00"));
  assert.equal(c.yearsLeft, 2);
  assert.match(c.text, /doesn't forecast growth/);
});
