const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../recruiting/logic.js");
const now = new Date(2026, 10, 24, 12);
const camps = [
  { program_id: "a", start_date: "2026-12-06", title: "Winter" },
  { program_id: "a", start_date: "2026-11-30", title: "Fall" },
  { program_id: "a", start_date: "2026-11-01", end_date: "2026-11-02", title: "Over" },
  { program_id: "b", start_date: "2026-11-20", end_date: "2026-11-25", title: "Running now" },
  { program_id: "c", start_date: "2027-01-10", record_status: "hidden" },
  { program_id: null, start_date: "2027-01-10" }
];
test("earliest camp that hasn't ended, per program", () => {
  const m = L.nextCampByProgram(camps, now);
  assert.equal(m.get("a").title, "Fall");
  assert.equal(m.get("b").title, "Running now");
  assert.ok(!m.has("c"));
  assert.equal(m.size, 2);
});
test("custom key (slug from an embedded program)", () => {
  const m = L.nextCampByProgram([{ start_date: "2026-12-01", programs: { slug: "uga" } }, { start_date: "2026-12-01", programs: null }], now, c => c.programs && c.programs.slug);
  assert.deepEqual([...m.keys()], ["uga"]);
});
