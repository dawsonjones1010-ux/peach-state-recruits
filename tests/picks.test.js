const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../estimator/picks.js");
const L = require("../recruiting/logic.js");
const progs = [
  { slug: "a", name: "Alpha U", level: "NCAA D1", conference: "Sun Belt", state: "Georgia" },
  { slug: "b", name: "Beta U", level: "NCAA D1", conference: "Southeastern", state: "Georgia" },
  { slug: "c", name: "Gamma U", level: "NCAA D1", conference: "Sun Belt", state: "Florida" },
  { slug: "d", name: "Delta U", level: "NCAA D1", conference: "Sun Belt", state: "California" },
  { slug: "e", name: "Eps College", level: "NCAA D2", conference: "Peach Belt", state: "Georgia" },
  { slug: "h", name: "Hidden U", level: "NCAA D1", conference: "Sun Belt", state: "Georgia", record_status: "hidden" }
].map(p => Object.assign({ band: L.bandOf(p) }, p));

test("home state first, target level before the next one down, then bordering states", () => {
  const r = P.pick(progs, ["p4", "mid"], "Georgia");
  assert.deepEqual(r.list.map(p => p.slug), ["b", "a", "c"]);
});
test("skips hidden listings, other levels and far-away states", () => {
  const slugs = P.pick(progs, ["p4", "mid"], "Georgia").list.map(p => p.slug);
  assert.ok(!slugs.includes("h") && !slugs.includes("e") && !slugs.includes("d"));
});
test("no state or no level means no list", () => {
  assert.equal(P.pick(progs, ["mid"], "").list.length, 0);
  assert.equal(P.pick(progs, [], "Georgia").list.length, 0);
});
test("every bordering state is a real state", () => {
  for (const s of L.STATE_NAMES) for (const n of P.nearNames(s)) assert.ok(L.STATE_NAMES.includes(n), s + " -> " + n);
});
