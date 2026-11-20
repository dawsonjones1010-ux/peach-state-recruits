// Unit tests for recruiting/logic.js. Run: node --test tests/recruiting.logic.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../recruiting/logic.js");
const fs = require("fs");
const path = require("path");

const PROGRAMS = [
  { id: "a", slug: "a", name: "Valdosta State", level: "NCAA D2", state: "Georgia", conference: "Gulf South", city: "Valdosta", record_status: "verified", last_checked: "2026-11-19" },
  { id: "b", slug: "b", name: "University of Georgia", level: "NCAA D1", state: "Georgia", conference: "Southeastern", record_status: "verified" },
  { id: "c", slug: "c", name: "Emory University", level: "NCAA D3", state: "Georgia", conference: "UAA", record_status: "unverified" },
  { id: "d", slug: "d", name: "Jones College", level: "JUCO", state: "Mississippi", conference: "MACCC", record_status: "unverified", avg_net_price: 9000, academic_year: "2022-23" }
];

test("classYear rolls over on Aug 1", () => {
  // 2026-27 school year: seniors are class of 2027, juniors 2028, sophomores 2029, freshmen 2030
  assert.equal(L.classYear(2027, "2026-11-19").key, "senior");
  assert.equal(L.classYear(2028, "2026-11-19").key, "junior");
  assert.equal(L.classYear(2029, "2026-11-19").key, "sophomore");
  assert.equal(L.classYear(2030, "2026-11-19").key, "freshman");
  assert.equal(L.classYear(2028, "2026-07-31").key, "sophomore");
  assert.equal(L.classYear(2028, "2026-08-01").key, "junior");
  assert.equal(L.classYear(2025, "2026-11-19").key, "graduated");
  assert.equal(L.classYear(2031, "2026-11-19").key, "middle");
});

test("keyDates: D1 Aug 1 before junior year, D2 June 15 after sophomore year", () => {
  assert.deepEqual(L.keyDates(2028), { d1Contact: "2026-08-01", d2Contact: "2026-06-15", juniorYearEnds: "2027-06-01" });
});

test("filterPrograms: search, level, state, verified, sort", () => {
  assert.equal(L.filterPrograms(PROGRAMS, { q: "georgia" }).length, 3);
  assert.deepEqual(L.filterPrograms(PROGRAMS, { q: "university of georgia" }).map(p => p.id), ["b"]);
  assert.equal(L.filterPrograms(PROGRAMS, { q: "gulf valdosta" })[0].id, "a");
  assert.deepEqual(L.filterPrograms(PROGRAMS, { levels: ["NCAA D1", "JUCO"] }).map(p => p.id).sort(), ["b", "d"]);
  assert.equal(L.filterPrograms(PROGRAMS, { states: ["Mississippi"] }).length, 1);
  assert.equal(L.filterPrograms(PROGRAMS, { verifiedOnly: true }).length, 2);
  assert.equal(L.filterPrograms(PROGRAMS, { sort: "level" })[0].level, "NCAA D1");
  assert.equal(L.filterPrograms(PROGRAMS, { hasAcademics: true })[0].id, "d");
});

test("Find My Level labels map to directory levels only", () => {
  assert.deepEqual(L.levelsFromFindMyLevel(["Mid-major D1", "Lower D1", "D2", "JUCO"]), ["NCAA D1", "NCAA D2", "JUCO"]);
  assert.deepEqual(L.levelsFromFindMyLevel([]), []);
});

const PROFILE = { first_name: "Jake", last_name: "Rivers", grad_year: 2028, primary_position: "SS", high_school: "Lassiter HS", hs_city: "Marietta", hs_state: "Georgia", contact_email: "jake@example.com", height_in: 72, weight_lb: 175, gpa: 3.6, video_url: "https://youtu.be/x", metrics: { exit_velo: 92, sixty: 6.9, if_velo: 85 } };

test("emails: all four kinds use profile and school, no invented facts", () => {
  const prog = PROGRAMS[0];
  for (const kind of Object.keys(L.KINDS)) {
    const e = L.buildEmail(kind, { profile: PROFILE, program: prog, coachName: "Mike Smith", lastSentOn: "2026-10-01", event: { title: "Fall Classic", start_date: "2026-12-05", city: "Atlanta", state: "Georgia" } });
    assert.ok(e.subject.length > 5, kind + " subject");
    assert.match(e.body, /Coach Smith,/);
    assert.match(e.body, /Jake Rivers/);
    assert.match(e.body, /jake@example\.com/);
    assert.doesNotMatch(e.body, /scholarship|offer you|roster spot/i, kind + " must not promise anything");
  }
  const intro = L.buildEmail("introduction", { profile: PROFILE, program: prog });
  assert.match(intro.body, /Valdosta State/);
  assert.match(intro.body, /6'0", 175 lb/);
  assert.match(intro.body, /exit velo 92 mph/);
  assert.match(intro.body, /^Coach,/);
  assert.match(L.buildEmail("event_invite", { profile: PROFILE, program: prog, event: { title: "Fall Classic", start_date: "2026-12-05", city: "Atlanta" } }).body, /Fall Classic/);
  assert.match(L.buildEmail("follow_up", { profile: PROFILE, program: prog, lastSentOn: "2026-10-01" }).body, /Oct 1, 2026/);
  assert.match(L.buildEmail("introduction", { profile: {}, program: null }).body, /\[Your name\]/, "placeholders when profile is empty");
  assert.throws(() => L.buildEmail("nope", {}));
});

test("mailto URL encodes subject and body", () => {
  const u = L.mailtoUrl("coach@school.edu", "Hi & hello", "Line 1\nLine 2");
  assert.equal(u, "mailto:coach@school.edu?subject=Hi%20%26%20hello&body=Line%201%0ALine%202");
  assert.equal(L.mailtoUrl("", "", ""), "mailto:");
});

test("tracker: status and due follow-ups", () => {
  const comms = [
    { id: "1", program_id: "a", direction: "sent", kind: "introduction", occurred_on: "2026-10-01", follow_up_on: "2026-10-11" },
    { id: "2", program_id: "a", direction: "received", kind: "reply", occurred_on: "2026-10-05" },
    { id: "3", program_id: "b", direction: "sent", kind: "introduction", occurred_on: "2026-11-01", follow_up_on: "2026-12-01" },
    { id: "4", program_id: "b", direction: "sent", kind: "update", occurred_on: "2026-11-02", follow_up_on: "2026-11-10", follow_up_done: true }
  ];
  const st = L.schoolStatus("a", comms);
  assert.equal(st.sent, 1); assert.equal(st.received, 1); assert.equal(st.awaitingReply, true);
  assert.equal(L.schoolStatus("b", comms).awaitingReply, false);
  assert.deepEqual(L.dueFollowUps(comms, "2026-11-19").map(c => c.id), ["1"]);
});

function ctx(over) {
  const byId = Object.fromEntries(PROGRAMS.map(p => [p.id, p]));
  return Object.assign({ profile: PROFILE, saved: [], comms: [], savedCamps: [], today: "2026-11-19", programName: id => (byId[id] || {}).name, programLevel: id => (byId[id] || {}).level }, over);
}

test("plan: incomplete profile comes first and every task explains why", () => {
  const c = L.planCandidates(ctx({ profile: { grad_year: 2028 } }));
  assert.equal(c[0].rule_key, "profile_basics");
  c.forEach(t => { assert.ok(t.why && t.title, t.rule_key); });
});

test("plan: due follow-up and coach reply outrank list building", () => {
  const saved = [{ id: "s1", program_id: "a", stage: "contacted" }];
  const comms = [{ id: "1", program_id: "a", direction: "sent", kind: "introduction", occurred_on: "2026-10-01", follow_up_on: "2026-11-01" }];
  const keys = L.planCandidates(ctx({ saved, comms })).map(t => t.rule_key);
  assert.equal(keys[0], "followups_due");
  assert.ok(keys.indexOf("followups_due") < keys.indexOf("build_list"));
});

test("plan: D1 window appears only in the 75 days before Aug 1 before junior year", () => {
  const p = Object.assign({}, PROFILE, { grad_year: 2029 }); // D1 date 2027-08-01
  assert.ok(!L.planCandidates(ctx({ profile: p, today: "2027-04-01" })).some(t => t.rule_key === "d1_contact_window"));
  assert.ok(L.planCandidates(ctx({ profile: p, today: "2027-06-01" })).some(t => t.rule_key === "d1_contact_window"));
  assert.ok(!L.planCandidates(ctx({ profile: Object.assign({}, p, { levels_of_interest: ["NCAA D3"] }), today: "2027-06-01" })).some(t => t.rule_key === "d1_contact_window"));
});

test("plan: NCAA registration only for sophomores+ interested in D1/D2", () => {
  const has = (prof, today) => L.planCandidates(ctx({ profile: Object.assign({}, PROFILE, prof), today })).some(t => t.rule_key === "ncaa_register");
  assert.equal(has({ grad_year: 2029 }, "2026-11-19"), true);                    // sophomore
  assert.equal(has({ grad_year: 2030 }, "2026-11-19"), false);                   // freshman
  assert.equal(has({ grad_year: 2028, levels_of_interest: ["NAIA"] }, "2026-11-19"), false);
  assert.equal(has({ grad_year: 2028, prep: { ncaa_registered: true } }, "2026-11-19"), false);
});

test("planView: top 3, done/dismissed hidden, postponed until date, custom tasks", () => {
  const cands = L.planCandidates(ctx({ profile: { grad_year: 2028 } }));
  assert.ok(cands.length >= 4);
  let v = L.planView(cands, [], "2026-11-19");
  assert.equal(v.next.length, 3);
  const first = v.next[0].rule_key;
  v = L.planView(cands, [{ id: "t1", rule_key: first, status: "done" }], "2026-11-19");
  assert.ok(!v.next.some(t => t.rule_key === first));
  v = L.planView(cands, [{ id: "t1", rule_key: first, status: "postponed", postponed_until: "2026-11-25" }], "2026-11-19");
  assert.ok(!v.next.some(t => t.rule_key === first));
  v = L.planView(cands, [{ id: "t1", rule_key: first, status: "postponed", postponed_until: "2026-11-25" }], "2026-11-25");
  assert.ok(v.next.some(t => t.rule_key === first), "returns on its date");
  v = L.planView(cands, [{ id: "t1", rule_key: first, status: "open", edited: true, title: "My words", detail: "x" }], "2026-11-19");
  assert.equal(v.all.find(t => t.rule_key === first).title, "My words");
  v = L.planView(cands, [{ id: "c1", rule_key: null, title: "Call coach", status: "open", due_on: "2026-11-18" }], "2026-11-19");
  assert.ok(v.next.some(t => t.title === "Call coach"), "overdue custom task is in the top 3");
});

test("planView: a dynamic task reopens when its subject changes", () => {
  const saved = [{ id: "s1", program_id: "a", stage: "contacted" }];
  const comms1 = [{ id: "1", program_id: "a", direction: "sent", occurred_on: "2026-10-01", follow_up_on: "2026-11-01" }];
  const c1 = L.planCandidates(ctx({ saved, comms: comms1 }));
  const fu = c1.find(t => t.rule_key === "followups_due");
  const st = [{ id: "t", rule_key: "followups_due", status: "done", rule_subkey: fu.subkey }];
  assert.ok(!L.planView(c1, st, "2026-11-19").next.some(t => t.rule_key === "followups_due"));
  const comms2 = comms1.concat([{ id: "2", program_id: "a", direction: "sent", occurred_on: "2026-11-05", follow_up_on: "2026-11-15" }]);
  const c2 = L.planCandidates(ctx({ saved, comms: comms2 }));
  assert.ok(L.planView(c2, st, "2026-11-19").next.some(t => t.rule_key === "followups_due"));
});

const CAMPS = [
  { id: "x1", title: "Past Camp", start_date: "2026-11-01", end_date: "2026-11-02", state: "Georgia", source_url: "https://a.edu", last_checked: "2026-10-01" },
  { id: "x2", title: "Winter Prospect Camp", start_date: "2026-12-13", state: "Michigan", price_cents: 18000, grad_years: [2027, 2028], source_url: "https://b.edu", last_checked: "2026-11-19", level: "NCAA D2" },
  { id: "x3", title: "Two Day Camp", start_date: "2026-11-18", end_date: "2026-11-20", state: "Georgia", source_url: "https://c.edu", last_checked: "2026-08-01" }
];
test("camps: past hidden, ongoing kept, filters", () => {
  assert.deepEqual(L.filterCamps(CAMPS, {}, "2026-11-19").map(c => c.id), ["x3", "x2"]);
  assert.deepEqual(L.filterCamps(CAMPS, { gradYear: 2029 }, "2026-11-19").map(c => c.id), ["x3"]);
  assert.deepEqual(L.filterCamps(CAMPS, { maxPrice: 150 }, "2026-11-19").map(c => c.id), ["x3"]);
  assert.deepEqual(L.filterCamps(CAMPS, { levels: ["NCAA D2"] }, "2026-11-19").map(c => c.id), ["x2"]);
  assert.equal(L.isStale(CAMPS[2], "2026-11-19", 45), true);
  assert.equal(L.isStale(CAMPS[1], "2026-11-19", 45), false);
});

test("ICS export: all-day events with exclusive end date and escaping", () => {
  const ics = L.buildICS([Object.assign({}, CAMPS[2], { title: "Camp, Day; 1", host_name: "Host" })], { now: "2026-11-19T12:00:00Z" });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261118\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261121\r\n/);
  assert.match(ics, /SUMMARY:Camp\\, Day\\; 1/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  ics.split("\r\n").forEach(line => assert.ok(line.length <= 75, "folded: " + line));
});

test("travel estimate: transparent arithmetic", () => {
  const e = L.travelEstimate({ miles_one_way: 250, mpg: 25, gas_price: 3, nights: 1, hotel_rate: 120, rooms: 1, days: 2, people: 2, meals_per_day: 3, meal_cost: 10, other: 15 }, { price_cents: 18000 });
  assert.deepEqual(e, { gas: 60, hotel: 120, meals: 120, registration: 180, other: 15, total: 495 });
  assert.equal(L.travelEstimate({ mpg: 0, miles_one_way: 100 }, null).gas, 0);
  assert.equal(L.travelEstimate({ include_registration: false }, { price_cents: 18000 }).registration, 0);
});

test("CSV parsing and program row validation", () => {
  const rows = L.parseCSV('name,level,state,avg_net_price,academic_year,athletics_url\n"Smith, College",NCAA D3,Ohio,"$21,500",2022-23,https://x.edu\nBad,NCAA D9,,15000,,ftp://x\n');
  assert.equal(rows.length, 2);
  const a = L.normalizeProgramRow(rows[0]);
  assert.deepEqual(a.errors, []);
  assert.equal(a.row.name, "Smith, College"); assert.equal(a.row.avg_net_price, 21500); assert.equal(a.row.slug, "smith-college");
  const b = L.normalizeProgramRow(rows[1]);
  assert.ok(b.errors.some(e => /level/.test(e)));
  assert.ok(b.errors.some(e => /athletics_url/.test(e)));
  assert.ok(b.errors.some(e => /academic_year/.test(e)), "cost numbers need a reporting year");
  assert.equal(L.normalizeProgramRow({ name: "X", level: "NAIA", admission_rate: "45%", academic_year: "2022-23" }).row.admission_rate, 0.45);
});

test("directory data: every program has a source, verified rows have links and dates", () => {
  const dir = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "programs.json"), "utf8"));
  assert.ok(dir.count > 1500);
  const slugs = new Set();
  dir.programs.forEach(p => {
    assert.ok(L.LEVELS.includes(p.level), p.name);
    assert.ok(dir.sources[p.level] && /^https:\/\//.test(dir.sources[p.level].url));
    assert.ok(!slugs.has(p.slug), "duplicate slug " + p.slug); slugs.add(p.slug);
    if (p.record_status === "verified") { assert.ok(p.roster_url && p.last_checked, p.name); }
    assert.ok(!("coach_email" in p) && !("scholarships" in p), "no invented recruiting fields");
  });
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "recruiting-seed.json"), "utf8"));
  seed.rules.forEach(r => assert.ok(/^https:\/\//.test(r.source_url) && r.last_checked, r.rule_key));
  seed.camps.forEach(c => { assert.ok(/^https:\/\//.test(c.source_url) && c.last_checked, c.title); assert.ok(slugs.has(c.program_slug), c.program_slug); });
});
