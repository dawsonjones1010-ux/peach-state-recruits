// v17 (Find My Level v2): context layers, recruiting clock, method chips, advanced fields,
// progress, opt-in review payload. Run: node --test tests/
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const L = require("../estimator/logic.js"), U = require("../estimator/summary.js"), V = require("../estimator/v2.js");
const PG = require("../estimator/progress.js"), CFG = require("../estimator/config.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/level-benchmarks-v1.0.json"), "utf8"));
const add = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/level-benchmarks-v1.1-additions.json"), "utf8"));
const base = (o) => Object.assign({ gradYear: 2027, primary: "CF", secondary: "", throws: "R", bats: "R", heightIn: null, weightLb: null, metrics: {}, methods: {}, meta: {} }, o);
const day = (s) => new Date(s + "T12:00:00");

test("additions file is Part 3's JSON, loaded next to v1, and never reaches the highlight rule", () => {
  assert.equal(CFG.ADDITIONS_URL, "data/level-benchmarks-v1.1-additions.json");
  assert.equal(CFG.DATA_URL, "data/level-benchmarks-v1.0.json");
  for (const c of add.sophomore_cohorts) assert.equal(c.exclude_from_automatic_classification, true);
  // logic.evaluate takes only the v1 data; identical inputs give identical results with any additions present
  const inp = base({ metrics: { maxEv: 95, sixty: 6.7, ofVelo: 90 }, meta: { grade: "10" } });
  const a = L.evaluate(data, inp), b = L.evaluate(Object.assign({}, data, { v11: add }), inp);
  assert.deepEqual(a.reads.map(r => U.headline(r)), b.reads.map(r => U.headline(r)));
  V.youngPanel(add, inp, a.reads); V.advanced(add, data, inp, a.reads);
  assert.deepEqual(L.evaluate(data, inp).reads.map(r => U.headline(r)), a.reads.map(r => U.headline(r)));
});

test("PBR_WI_E stays hidden everywhere", () => {
  const wi = add.sophomore_cohorts.find(c => c.source_id === "PBR_WI_E");
  assert.equal(wi.use, "hidden_until_owner_review");
  const inps = [base({ primary: "SS", metrics: { maxEv: 92, sixty: 6.9, ifVelo: 84 }, meta: { grade: "10" } }), base({ primary: "P", metrics: { maxFb: 84 }, meta: { grade: "10" } })];
  for (const inp of inps) {
    const y = V.youngPanel(add, inp, L.evaluate(data, inp).reads);
    assert.ok(!JSON.stringify(y).includes("Wisconsin"));
    assert.ok(!y.reads.some(r => r.groups.some(g => g.source && g.source.id === "PBR_WI_E")));
  }
});

test("grade when measured: answer wins, else grad year + date; age is never used", () => {
  assert.equal(V.gradeWhenMeasured(base({ meta: { grade: "10" } })).grade, 10);
  assert.equal(V.gradeWhenMeasured(base({ meta: { grade: "grad" } })).grade, 13);
  assert.equal(V.gradeWhenMeasured(base({ gradYear: 2028, meta: { date: "2026-03-10" } })).grade, 10);
  assert.equal(V.gradeWhenMeasured(base({ gradYear: 2028, meta: {} })).grade, null);
  assert.equal(V.gradeWhenMeasured(base({ age: 15, gradYear: 2028, meta: {} })).grade, null);
});

test("young panel: sophomores only; freshmen get the short line; unknown asks the grade question", () => {
  const run = (o) => { const i = base(o); return V.youngPanel(add, i, L.evaluate(data, i).reads); };
  assert.equal(run({ meta: { grade: "11" } }).status, "none");
  const fr = run({ gradYear: 2029, metrics: { maxEv: 80 }, meta: { grade: "9" } });
  assert.equal(fr.status, "freshman"); assert.match(fr.line, /No freshman-year data has been published/); assert.ok(!fr.reads);
  assert.equal(run({ meta: { grade: "8" } }).status, "freshman");
  assert.match(run({ meta: {} }).line, /what grade you were in/);
  assert.equal(run({ metrics: { maxEv: 88 }, meta: { grade: "10" } }).status, "panel");
});

test("pitcher sophomore panel: by hand, peak-FB band wording, under-85 fact", () => {
  const i = base({ gradYear: 2028, primary: "P", throws: "R", metrics: { maxFb: 86, fbSpin: 2200 }, meta: { date: "2026-06-10" } });
  const y = V.youngPanel(add, i, L.evaluate(data, i).reads);
  assert.equal(y.status, "panel");
  const p = y.reads[0];
  assert.equal(p.band, "Your 86 mph peak sits between the 16th and 50th percentile of Indiana's eventual D1 arms as sophomores.");
  assert.ok(p.spinBand && /rpm fastball spin sits/.test(p.spinBand));
  assert.ok(p.groups[0].title.includes("RHP"));
  assert.equal(p.groups[0].rows[0].cols[0].mean, add.sophomore_cohorts[0].means.peak_fb_mph.D1.RHP);
  assert.equal(p.facts.length, 0, "no under-85 fact at 86");
  const lo = base({ primary: "P", throws: "L", metrics: { maxFb: 83 }, meta: { grade: "10" } });
  const yl = V.youngPanel(add, lo, L.evaluate(data, lo).reads).reads[0];
  assert.match(yl.facts.join(" "), /18 eventual D1 signees threw under 85.*4 became Power 4/);
  assert.ok(yl.groups.every(g => g.region && g.n != null), "state and sample size always present");
  assert.ok(yl.groups.some(g => g.earlyOnly), "early-commit group labeled");
});

test("hitter sophomore panel: position groups, early commits only, small-sample warning, 2B uses overall only", () => {
  const run = (pos, m) => { const i = base({ primary: pos, metrics: m || { maxEv: 90, sixty: 6.9 }, meta: { grade: "10" } }); return V.youngPanel(add, i, L.evaluate(data, i).reads).reads[0]; };
  const of = run("CF");
  assert.match(of.groups[0].title, /OF/); assert.ok(of.groups.every(g => g.earlyOnly));
  const E = add.sophomore_cohorts.find(c => c.source_id === "PBR_IN_E");
  for (const [pos, grp] of [["SS", "SS"], ["C", "C"], ["1B", "1B/3B"], ["3B", "1B/3B"], ["LF", "OF"]]) {
    const r = run(pos, { maxEv: 90 }); const n = E.by_position[grp].n;
    assert.match(r.groups[0].title, new RegExp(grp.replace("/", "\\/")));
    assert.equal(r.groups[0].smallSample, Object.values(n).some(x => x < 6), pos);
  }
  const b2 = run("2B");
  assert.equal(b2.groups.length, 1); assert.ok(b2.groups[0].overall); assert.match(b2.noPositionGroup, /no 2B group/);
});

test("recruiting clock: open levels, next date countdown, Indiana wave labeled as one state's data, NAIA shown", () => {
  const c = V.clock(add, 2029, day("2026-11-19"));
  assert.deepEqual(c.openLevels, ["D3", "NAIA", "JUCO"]);
  assert.deepEqual(c.closedLevels, ["D1", "D2"]);
  assert.equal(c.next.level, "D2"); assert.equal(c.next.dateText, "June 15, 2027"); assert.equal(c.next.days, 208);
  assert.ok(c.rules.some(r => r.level === "NAIA" && /does not regulate/.test(r.event)));
  assert.ok(!c.rules.some(r => /VERIFY/.test(r.when)));
  assert.match(c.waveNote, /one state's data/); assert.equal(c.wave.key, "before");
  const c28 = V.clock(add, 2028, day("2026-11-19"));
  assert.deepEqual(c28.openLevels, ["D1", "D2", "D3", "NAIA", "JUCO"]); assert.equal(c28.next, null); assert.equal(c28.wave.key, "wave1");
  const d1 = V.clock(add, 2028, day("2026-07-20"));
  assert.equal(d1.next.level, "D1"); assert.equal(d1.next.dateText, "August 1, 2026"); assert.equal(d1.next.days, 12);
  assert.ok(V.clock(add, 2026, day("2026-11-19")).graduated);
  assert.equal(V.clock(add, null, day("2026-11-19")), null);
});

test("method chips: shown per number, hand-time note, never converted", () => {
  const i = base({ metrics: { sixty: 6.7, maxEv: 95 }, methods: { sixty: "hand", ev: "tee", evDevice: "trackman" }, meta: { date: "2026-10-01", source: "showcase" } });
  assert.ok(V.chips(i, "sixty").includes("Hand-timed"));
  assert.equal(V.chipNote(i, "sixty"), "Hand times usually read faster than laser times.");
  assert.ok(V.chips(i, "maxEv").includes("Tee") && V.chips(i, "maxEv").includes("TrackMan"));
  const laser = base({ metrics: { sixty: 6.7 }, methods: { sixty: "laser" } });
  assert.ok(!V.chipNote(laser, "sixty"));
  // the evaluated value is exactly what was typed
  const r = L.evaluate(data, i);
  assert.ok(JSON.stringify(r).includes("6.7"));
  assert.ok(!/6\.[0-6]\d? s/.test(JSON.stringify(V.chips(i, "sixty"))));
  const ev = JSON.stringify(L.evaluate(data, base({ metrics: { sixty: 6.7 }, methods: { sixty: "hand" } })));
  assert.match(ev, /Hand-timed\. Timing methods aren't interchangeable; we don't adjust your time\./);
  assert.match(ev, /"value":6\.7/);
});

test("advanced fields parse and compare as context only", () => {
  assert.equal(L.parseEntry("2,250", "rpm").value, 2250);
  assert.equal(L.parseEntry("-3.5", "signed").value, -3.5);
  const i = base({ primary: "P", metrics: { maxFb: 86, fbSpin: 2250, bbSpin: 2500, extension: 6.1, ivb: 16.5 } });
  const a = V.advanced(add, data, i, L.evaluate(data, i).reads);
  const keys = a.rows.map(r => r.key);
  assert.deepEqual(keys, ["fbSpin", "bbSpin", "ivb", "extension"]);
  assert.match(a.rows.find(r => r.key === "extension").note, /No published level comparison/);
  const h = base({ metrics: { maxEv: 90, batSpeed: 70 } });
  const ah = V.advanced(add, data, h, L.evaluate(data, h).reads);
  const bs = ah.rows.find(r => r.key === "batSpeed");
  assert.ok(bs.ranges.length >= 1 && bs.ranges.every(x => /Below|Within|Above/.test(x.where)));
  assert.equal(V.advanced(add, data, base({ metrics: { maxEv: 90 } }), []), null);
  assert.ok(L.validate(base({ primary: "P", metrics: { fbSpin: 9000 } })).errors.some(e => e.field === "fbSpin"));
});

test("CTA sentence is chosen by the result and sends players to film", () => {
  const top = base({ metrics: { maxEv: 103, sixty: 6.4, ofVelo: 96 } });
  const s = V.ctaSentence(L.evaluate(data, top).reads[0]);
  assert.match(s, /Coaches still need to see/);
  const p = base({ primary: "P", metrics: { maxFb: 88 } });
  assert.match(V.ctaSentence(L.evaluate(data, p).reads[0]), /fastball|film/);
  const blank = base({});
  assert.equal(typeof V.ctaSentence(L.evaluate(data, blank).reads[0]), "string");
});

test("review payload: only what the player sends, clean handle, no age", () => {
  assert.equal(V.cleanHandle("@peach.state_1"), "peach.state_1");
  assert.equal(V.cleanHandle("bad handle!"), null);
  const i = base({ primary: "SS", secondary: "P", metrics: { maxEv: 92, sixty: 6.9, ifVelo: 85, maxFb: 86 }, methods: { sixty: "laser" }, meta: { grade: "11", date: "2026-10-01" } });
  const pl = V.reviewPayload("@kid27", i, L.evaluate(data, i));
  assert.deepEqual(Object.keys(pl).sort(), ["bats", "data_version", "grad_year", "headline", "ig_handle", "methods", "metrics", "positions", "throws"]);
  assert.equal(pl.positions, "SS/P"); assert.equal(pl.grad_year, 2027);
  assert.ok(pl.headline.length <= 400);
  assert.ok(!JSON.stringify(pl).includes('"age"'));
});

test("progress: saved per result, 'since last time' deltas, sparkline, clear", () => {
  const mem = { s: {}, getItem(k) { return this.s[k] ?? null; }, setItem(k, v) { this.s[k] = String(v); }, removeItem(k) { delete this.s[k]; } };
  const e1 = PG.entryFrom(base({ metrics: { maxEv: 88, sixty: 7.0 } }), ["D2"], new Date("2026-03-10T12:00:00"));
  PG.save(mem, e1);
  const e2 = PG.entryFrom(base({ metrics: { maxEv: 91, sixty: 6.85 } }), ["D1-MM"], new Date("2026-10-01T12:00:00"));
  const h = PG.save(mem, e2);
  assert.equal(h.length, 2);
  const d = PG.deltas(h, h[1]);
  assert.ok(d.items.find(x => x.key === "maxEv").better);
  assert.ok(d.items.find(x => x.key === "sixty").better, "lower 60 time is better");
  assert.match(d.items.find(x => x.key === "maxEv").text, /\+3 mph max exit velocity since Mar 2026/);
  assert.match(PG.sparkline(PG.series(h, "CF", "maxEv")), /^<svg[^>]*class="lvl-spark"/);
  assert.equal(PG.sparkline(PG.series(h.slice(0, 1), "CF", "maxEv")), "");
  assert.ok(!JSON.stringify(h).includes("age"));
  PG.clear(mem); assert.equal(PG.load(mem).length, 0);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => { PG.save(broken, e1); PG.load(broken); PG.clear(broken); });
});

test("age is gone from the estimator", () => {
  for (const f of ["estimator/ui.js", "estimator/logic.js", "estimator/config.js", "estimator/summary.js", "estimator/v2.js", "estimator/progress.js"]) {
    const s = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.ok(!/f_age|"age"|input\.age|\bage:|Age when measured/.test(s), f);
  }
  assert.ok(!("age" in CFG.RANGES));
});
