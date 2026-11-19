// Playwright UI tests for Find My Level.
// Run: NODE_PATH=/path/to/node_modules node tests/estimator.ui.js <base-url> [screenshot-dir]
// e.g. node tests/estimator.ui.js http://127.0.0.1:47613/peach-state-recruits/ /workspace/psr_v12_shots
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:47613/peach-state-recruits/").replace(/\/?$/, "/");
const SHOTS = process.argv[3] || "";
let pass = 0, fail = 0; const failures = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; failures.push(name); } console.log(`${cond ? "  ok  " : "  FAIL"} ${name}`); };

async function start(page, s) {
  await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" });
  await page.waitForSelector('form[data-step="1"]');
  await page.fill("#f_age", String(s.age || 17));
  await page.selectOption("#f_gradYear", String(s.grad || 2027));
  await page.selectOption("#f_primary", s.primary);
  if (s.secondary) await page.selectOption("#f_secondary", s.secondary);
  await page.check(`input[name=throws][value=${s.throws || "R"}]`, { force: true });
  await page.check(`input[name=bats][value=${s.bats || "R"}]`, { force: true });
  await page.click("form button[type=submit]");
  await page.waitForSelector('form[data-step="2"]');
}
async function numbers(page, vals) {
  for (const [k, v] of Object.entries(vals)) {
    if (v === "idk") await page.check(`[data-unknown="${k}"]`); else await page.fill(`#f_${k}`, String(v));
  }
}
async function next(page) { await page.click("form button[type=submit]"); await page.waitForTimeout(150); }
async function evidence(page, meta) {
  await page.waitForSelector('form[data-step="3"]');
  meta = meta || {};
  if (meta.date === "idk") await page.check('[data-unknown="date"]'); else if (meta.date) await page.fill("#f_date", meta.date);
  if (meta.environment) await page.selectOption("#f_environment", meta.environment);
  if (meta.method) await page.selectOption("#f_method", meta.method);
  if (meta.source != null) await page.check(`input[name=source][value="${meta.source}"]`, { force: true });
  if (meta.link) await page.fill("#f_link", meta.link);
  await next(page);
  await page.waitForSelector(".lvl-results");
}
const hlCats = (page, idx) => page.$$eval(".lvl-read", (rs, i) => [...rs[i].querySelectorAll(".lvl-cat.is-hl")].map(x => x.dataset.cat), idx || 0);
const readsHl = (page) => page.$$eval(".lvl-read", rs => rs.map(r => [...r.querySelectorAll(".lvl-cat.is-hl")].map(x => x.dataset.cat)));
const catText = (page, read, key) => page.$$eval(".lvl-read", (rs, [i, k]) => { const e = rs[i].querySelector(`.lvl-cat[data-cat="${k}"]`); e.open = true; return e.innerText; }, [read, key]);

(async () => {
  const browser = await chromium.launch();
  for (const [vw, tag, mobile] of [[1440, "desktop", false], [390, "phone", true]]) {
    console.log(`\n== ${tag} ${vw}px ==`);
    const ctx = await browser.newContext({ viewport: { width: vw, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const errs = [], posts = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", e => errs.push(String(e)));
    // Only the estimator page is checked: other pages keep their existing behaviour (e.g. profile view counts).
    page.on("request", r => { if (!/find-my-level/.test(page.url())) return; const same = r.url().startsWith(BASE) || /fonts\.(googleapis|gstatic)\.com/.test(r.url()); if (r.method() !== "GET" || !same) posts.push(r.method() + " " + r.url()); });
    const overflow = async (name) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= vw, `${tag}: no horizontal overflow (${name}, ${w}px)`); };

    // 1. Pitcher (RHP), velocity-only, no hitting fields
    await start(page, { primary: "P", throws: "R" });
    if (SHOTS && mobile) await page.screenshot({ path: `${SHOTS}/phone-step2-pitcher.png`, fullPage: true });
    ok(!(await page.$("#f_maxEv")) && !(await page.$("#f_sixty")), `${tag}: pitcher step 2 asks no hitting/running numbers`);
    await numbers(page, { maxFb: 88, typFb: 85 });
    await page.check('[data-rep="Slider"]', { force: true }); await page.check('[data-rep="Changeup"]', { force: true });
    await next(page); await evidence(page, { date: "2026-06-15", environment: "game", method: "radar", source: "self" });
    ok(await page.isVisible("text=Velocity comparison only"), `${tag}: pitcher labeled "Velocity comparison only"`);
    ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(["mid", "low", "d2", "d3", "naia", "juco"]), `${tag}: RHP 88 mph matches mid-major down to JUCO, not Power`);
    ok((await page.textContent(".lvl-results")).includes("Repertoire: Slider, Changeup"), `${tag}: repertoire recorded, not scored`);
    ok((await page.textContent(".lvl-results")).includes("This compares your current metrics with published benchmarks. Coaches also evaluate game performance, defense, projection and roster needs. It does not predict an offer."), `${tag}: required note shown`);
    await overflow("pitcher results");

    // 2. Infielder SS + validation behaviour
    await start(page, { primary: "SS" });
    await numbers(page, { maxEv: 93, sixty: "6:80", ifVelo: 86 });
    await next(page);
    ok(await page.isVisible("#lvlSummary") && (await page.textContent("#lvlSummary")).includes("decimal"), `${tag}: "6:80" is rejected with a decimal-seconds message`);
    ok(await page.$('form[data-step="2"]') !== null, `${tag}: invalid entry blocks the step`);
    await page.fill("#f_sixty", "6.0"); await next(page);
    ok(await page.isVisible(".lvl-warn"), `${tag}: unusual 60 time asks for confirmation`);
    await page.fill("#f_sixty", "6.80"); await next(page);
    await evidence(page, { date: "idk", source: "" });
    ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(["p4", "mid", "d2", "d3", "naia", "juco"]), `${tag}: SS 93/6.80 highlights Power through JUCO (Lower D1 has no targets)`);
    const lowTxt = await catText(page, 0, "low");
    ok(lowTxt.includes("No published benchmark") && lowTxt.includes("data gap"), `${tag}: Lower D1 shown as missing benchmark, not a negative`);
    ok((await catText(page, 0, "p4")).includes("NCSA REFERENCE") || (await catText(page, 0, "p4")).toLowerCase().includes("ncsa reference"), `${tag}: NCSA reference shown separately`);
    const resTxt = await page.textContent(".lvl-results");
    ok(resTxt.includes("Measurement date unknown"), `${tag}: unknown metadata consequence labeled`);
    ok(resTxt.includes("count as one piece of evidence"), `${tag}: NAIA/JUCO pooled targets flagged as one piece of evidence`);
    ok(!/probability|percentile|fit score|% chance/i.test(resTxt), `${tag}: no fabricated scores or probabilities`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-results-ss.png`, fullPage: !mobile ? false : false });
    // Update my numbers keeps values
    await page.click("text=Update my numbers"); await page.waitForSelector('form[data-step="1"]');
    ok((await page.inputValue("#f_age")) === "17" && (await page.inputValue("#f_primary")) === "SS", `${tag}: "Update my numbers" keeps entries`);
    await next(page); ok((await page.inputValue("#f_maxEv")) === "93", `${tag}: step 2 values kept after update`);

    // 3. Outfielders: LF -> Corner OF, CF -> CF
    for (const [pos, expect] of [["LF", "Meets listed target"], ["CF", "Below listed target"]]) {
      await start(page, { primary: pos });
      await numbers(page, { maxEv: 94, sixty: 6.75, ofVelo: 88 }); await next(page); await evidence(page, {});
      const t = await catText(page, 0, "p4");
      const runLine = t.split("\n").slice(t.split("\n").findIndex(l => /^Running/.test(l)), t.split("\n").findIndex(l => /^Running/.test(l)) + 4).join(" ");
      ok(runLine.includes(expect) && runLine.includes(pos === "LF" ? "6.7–6.8" : "6.5–6.7"), `${tag}: ${pos} 6.75 uses the ${pos === "LF" ? "Corner OF (6.7–6.8)" : "CF (6.5–6.7)"} target → ${expect}`);
      ok(await page.isVisible("text=Flatground: outfielders during or after their junior season"), `${tag}: ${pos} gets the Flatground OF panel`);
      if (pos === "CF" && SHOTS) {
        await page.evaluate(() => document.querySelectorAll(".lvl-panel").forEach((d, i) => { if (i === 0) d.open = true; }));
        if (mobile) await page.screenshot({ path: `${SHOTS}/phone-results-cf.png`, fullPage: true });
        else { await page.screenshot({ path: `${SHOTS}/desktop-results-cf.png`, fullPage: true }); }
      }
    }

    // 4. Catcher: pop + D3 2.10+ is reference only
    await start(page, { primary: "C" });
    ok(!!(await page.$("#f_pop")) && !!(await page.$("#f_cVelo")), `${tag}: catcher asked for pop time and catcher throw`);
    await numbers(page, { maxEv: 91, sixty: 7.2, cVelo: 80, pop: 1.95 }); await next(page);
    await evidence(page, { date: "2026-07-20", environment: "showcase", method: "electronic", source: "event", link: "https://example.com/result" });
    const d3 = await catText(page, 0, "d3");
    ok(d3.includes("Source reference only") && d3.includes("2.1 s+"), `${tag}: D3 2.10+ pop row is reference only`);
    ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(["p4", "mid", "d2", "d3", "naia", "juco"]), `${tag}: catcher 91/7.2/1.95 highlights where every compared tool meets`);
    const ct = await page.textContent(".lvl-results");
    ok(ct.includes("A link alone doesn't verify") && !/\bverified\b(?! *\.)/.test(ct.replace(/marked verified|doesn't verify|not verified/g, "")), `${tag}: link recorded but not marked verified`);

    // 5. Two-way: SS + P, separate reads
    await start(page, { primary: "SS", secondary: "P" });
    ok(!!(await page.$("#f_maxFb")) && !!(await page.$("#f_maxEv")), `${tag}: two-way step 2 shows pitching and hitting fields`);
    await numbers(page, { maxFb: 86, maxEv: 90, sixty: 6.9, ifVelo: 84 }); await next(page); await evidence(page, {});
    const heads = await page.$$eval(".lvl-read h3", e => e.map(x => x.textContent));
    ok(heads.length === 2 && /Position read: SS/.test(heads[0]) && /Pitching read/.test(heads[1]), `${tag}: two separate reads (position and pitching)`);
    ok(await page.isVisible("text=never blended into one result"), `${tag}: two-way explanation shown`);
    if (SHOTS && !mobile) await page.screenshot({ path: `${SHOTS}/desktop-results-twoway.png`, fullPage: false });

    // 6. Missing benchmarks: 1B with elite numbers still needs more info
    await start(page, { primary: "1B" });
    await numbers(page, { maxEv: 100, sixty: 6.6, ifVelo: 88 }); await next(page); await evidence(page, {});
    ok(await page.isVisible("text=More information needed for an overall range"), `${tag}: 1B shows "More information needed" (no corner-IF running targets)`);
    ok((await catText(page, 0, "p4")).includes("No published benchmark"), `${tag}: 1B running shows "No published benchmark"`);

    // 7. Contradiction: typical > max
    await start(page, { primary: "P", throws: "L" });
    await numbers(page, { maxFb: 82, typFb: 85 }); await next(page);
    ok((await page.textContent("#lvlSummary")).includes("can't be higher"), `${tag}: typical fastball above max is flagged`);

    // 8. All unknown: no division
    await page.fill("#f_maxFb", ""); await page.fill("#f_typFb", ""); await page.check('[data-unknown="maxFb"]');
    await next(page); await evidence(page, { date: "idk" });
    ok(await page.isVisible("text=More information needed for an overall range") && (await page.$$(".lvl-cat.is-hl")).length === 0, `${tag}: all-unknown input gives no division`);
    await overflow("all-unknown results");

    // Screens of the form steps (phone)
    if (SHOTS && mobile) {
      await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" });
      await page.screenshot({ path: `${SHOTS}/phone-step1.png`, fullPage: false });
      await page.evaluate(() => document.querySelector(".lvl-main").scrollIntoView());
      await page.screenshot({ path: `${SHOTS}/phone-step1-form.png`, fullPage: false });
      await start(page, { primary: "C", secondary: "P" });
      await page.screenshot({ path: `${SHOTS}/phone-step2-catcher-twoway.png`, fullPage: true });
      await numbers(page, { maxEv: 88, sixty: 7.4, cVelo: 76, pop: 2.08, maxFb: 84 }); await next(page);
      await page.screenshot({ path: `${SHOTS}/phone-step3.png`, fullPage: true });
      await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" });
      await page.click("form button[type=submit]");
      await page.screenshot({ path: `${SHOTS}/phone-step1-errors.png`, fullPage: false });
    }

    // Existing flows and entry points
    await page.goto(BASE, { waitUntil: "networkidle" });
    ok(await page.$('a.nav-level[href="find-my-level.html"]') !== null && await page.isVisible("#find-my-level"), `${tag}: homepage has nav link and Find My Level band`);
    ok((await page.$$(".ex")).length === 3, `${tag}: homepage featured examples still render`);
    await page.goto(BASE + "players.html", { waitUntil: "networkidle" });
    ok(/players?/.test(await page.textContent("#count")), `${tag}: players page still works`);
    await page.goto(BASE + "player/beck-hoover/", { waitUntil: "networkidle" });
    ok(await page.isVisible("h1") && (await page.textContent("h1")).includes("Beck"), `${tag}: player profile still works`);
    ok(errs.length === 0, `${tag}: no console errors${errs.length ? " → " + errs.join(" | ") : ""}`);
    ok(posts.length === 0, `${tag}: estimator sends no data anywhere (only same-site files and fonts are requested)${posts.length ? " → " + posts.join(", ") : ""}`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\nUI tests: ${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failures:\n- " + failures.join("\n- ")); process.exit(1); }
})();
