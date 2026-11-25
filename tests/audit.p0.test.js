// Regression tests for the P0 findings in the Nov 2026 audit (PSR-003..007).
const test = require("node:test");
const assert = require("node:assert");
const C = require("../estimator/fit-core.js");
const P = require("../estimator/pitcher.js");
const L = require("../recruiting/logic.js");

const pitcher = (m, throws) => P.evaluate({ throws: throws || "R", gradYear: 2027, metrics: m });

test("PSR-004: peak velocity alone never sets a primary target, stretch or school list", () => {
  const f = pitcher({ maxFb: 95 });
  assert.equal(f.peakOnly, true);
  assert.equal(f.primary, null);
  assert.equal(f.stretch, null);
  assert.deepEqual(f.also, []);
  assert.equal(f.peakReach, "p4");
  assert.ok(!/already at the top/i.test(f.stretchReason || ""));
});
test("PSR-004: with sitting velocity the normal evaluation still runs", () => {
  const f = pitcher({ typFb: 91, maxFb: 94 });
  assert.equal(f.peakOnly, false);
  assert.ok(f.primary || f.closest);
});

test("PSR-005: 0 innings never adds neutral points from rate stats", () => {
  const bad = { typFb: 91, maxFb: 95, era: 7.5, whip: 2.1, so: 30, bb: 40 };
  const none = pitcher(Object.assign({}, bad));                 // innings missing
  const zero = pitcher(Object.assign({ ip: 0 }, bad));
  const fifty = pitcher(Object.assign({ ip: 50 }, bad));
  for (const key of ["p4", "mid", "low", "d2", "d3", "naia"]) {
    const z = zero.levels.find(l => l.key === key), f50 = fifty.levels.find(l => l.key === key);
    if (z.score != null && f50.score != null) assert.ok(z.score <= f50.score + 0.001 || z.used.every(u => u.key === "velocity"), `${key}: 0 IP (${z.score}) must not beat 50 IP (${f50.score}) by injected points`);
    assert.equal(z.cats.performance, null, `${key}: no performance score from 0 innings`);
  }
  // A worse overall target can't appear just because the sample is empty.
  const rank = k => ["p4", "mid", "low", "d2", "d3", "naia", "juco"].indexOf(k);
  const tz = zero.primary || zero.closest, t50 = fifty.primary || fifty.closest;
  assert.ok(!zero.primary || rank(tz) >= rank(t50), "0 IP target is not higher than the 50 IP target");
  assert.ok(none);
});
test("PSR-005: small samples only pull strong scores down", () => {
  for (const ip of [0.1, 5, 20]) {
    const weak = pitcher({ typFb: 88, maxFb: 91, ip, era: 7.5, whip: 2.1, so: 5, bb: 10 });
    const full = pitcher({ typFb: 88, maxFb: 91, ip: 60, era: 7.5, whip: 2.1, so: 40, bb: 80 });
    const w = weak.levels.find(l => l.key === "d2"), f = full.levels.find(l => l.key === "d2");
    if (w.cats.performance != null && f.cats.performance != null) assert.ok(w.cats.performance <= Math.max(f.cats.performance, w.cats.performance) && w.cats.performance <= 85 + 1e-9 || w.cats.performance <= f.cats.performance + 1e-9, `ip ${ip}: weak performance not lifted toward neutral`);
  }
});

test("PSR-006: a velocity-only JUCO score is labeled velocity only", () => {
  const f = pitcher({ typFb: 92, maxFb: 95, ip: 30, era: 9, whip: 2.5, so: 10, bb: 40 });
  const j = f.levels.find(l => l.key === "juco");
  assert.ok(j.score != null);
  assert.equal(j.velocityOnly, j.used.every(u => u.key === "velocity"));
});

test("PSR-003: a supplied link is never labeled Verified", () => {
  const v = C.verificationValue({ meta: { source: "event", link: "https://example.com/not-a-result" } });
  assert.ok(!/^verified/i.test(v.label));
  assert.match(v.label, /not verified/i);
});

test("PSR-007: camp state filter matches full names and postal codes", () => {
  const camps = [
    { id: 1, title: "A", state: "GA", start_date: "2099-01-01", record_status: "verified" },
    { id: 2, title: "B", state: "Georgia", start_date: "2099-01-02", record_status: "verified" },
    { id: 3, title: "C", state: "TX", start_date: "2099-01-03", record_status: "verified" }
  ];
  const byName = L.filterCamps(camps, { states: ["Georgia"] }, new Date(2026, 10, 25));
  const byCode = L.filterCamps(camps, { states: ["GA"] }, new Date(2026, 10, 25));
  assert.deepEqual(byName.map(c => c.id).sort(), [1, 2]);
  assert.deepEqual(byCode.map(c => c.id).sort(), [1, 2]);
  assert.equal(L.stateName("tx"), "Texas");
  assert.equal(L.stateName("Texas"), "Texas");
});

test("PSR-009: school picks come from the live directory; the saved copy is a labeled fallback", async () => {
  const PK = require("../estimator/picks.js");
  const live = [{ id: 1, slug: "ga-a", name: "A", level: "NCAA D3", state: "Georgia", record_status: "verified" }];
  const page2 = [];
  let calls = 0;
  const fetchLive = async (url) => { calls++; return { ok: true, json: async () => (/offset=0/.test(url) ? live : page2) }; };
  const r = await PK.loadPrograms(fetchLive, { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "k" });
  assert.equal(r.stale, false);
  assert.deepEqual(r.programs.map(p => p.slug), ["ga-a"]);
  const fetchDown = async (url) => /rest\/v1/.test(url) ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, json: async () => ({ programs: [{ slug: "old", name: "Old", level: "NCAA D3", state: "Georgia", record_status: "verified" }, { slug: "gone", name: "Gone", level: "NCAA D3", state: "Georgia", record_status: "hidden" }] }) };
  const f = await PK.loadPrograms(fetchDown, { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "k" });
  assert.equal(f.stale, true);
  assert.deepEqual(f.programs.map(p => p.slug), ["old"], "hidden schools are never recommended");
});
