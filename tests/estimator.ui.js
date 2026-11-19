// Playwright UI tests for Find My Level.
// Run: NODE_PATH=/path/to/node_modules node tests/estimator.ui.js <base-url> [screenshot-dir]
// e.g. node tests/estimator.ui.js http://127.0.0.1:47613/peach-state-recruits/ /workspace/psr_v13_shots
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
  await page.$eval(`input[name=throws][value=${s.throws || "R"}]`, el => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.$eval(`input[name=bats][value=${s.bats || "R"}]`, el => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
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
  if (meta.source != null) await page.$eval(`input[name=source][value="${meta.source}"]`, el => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
  if (meta.link) await page.fill("#f_link", meta.link);
  await next(page);
  await page.waitForSelector(".lvl-results");
}
const hlCats = (page, idx) => page.$$eval(".lvl-read", (rs, i) => [...rs[i].querySelectorAll(".lvl-cat.is-hl")].map(x => x.dataset.cat), idx || 0);
const readsHl = (page) => page.$$eval(".lvl-read", rs => rs.map(r => [...r.querySelectorAll(".lvl-cat.is-hl")].map(x => x.dataset.cat)));
const catText = (page, read, key) => page.$$eval(".lvl-read", (rs, [i, k]) => { const tp = rs[i].closest(".lvl-tabpanel"); if (tp) tp.hidden = false; const sec = rs[i].querySelector('[data-sec="levels"]'); sec.open = true; const e = rs[i].querySelector(`.lvl-cat[data-cat="${k}"]`); e.open = true; return e.innerText; }, [read, key]);
const levelRow = (page, idx) => page.$$eval(".lvl-read", (rs, i) => [...rs[i].querySelectorAll(".lvl-lrow li")].map(li => li.querySelector("b").textContent + ": " + li.querySelector("span").textContent), idx || 0);
const mainText = (page, idx) => page.$$eval(".lvl-read", (rs, i) => [".lvl-res-title", ".lvl-head", ".lvl-head-sup", ".lvl-head-cav", ".lvl-next-t"].map(q => rs[i].querySelector(q).textContent), idx || 0);
const LEVELS = ["Power D1", "Mid-major D1", "Lower D1", "D2", "D3", "NAIA", "JUCO"];

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
    page.on("request", r => { if (!/find-my-level/.test(page.url())) return; const same = r.url().startsWith(BASE) || r.url().startsWith("blob:") || /fonts\.(googleapis|gstatic)\.com/.test(r.url()); if (r.method() !== "GET" || !same) posts.push(r.method() + " " + r.url()); });
    const fitsFirst = () => page.evaluate(() => { const p = document.querySelector(".lvl-tabpanel:not([hidden])"); const b = p.querySelector(".lvl-cta2").getBoundingClientRect(); const t = p.querySelector(".lvl-head-card").getBoundingClientRect(); return t.top >= 0 && b.bottom <= innerHeight; });
    const story = async (idx, file) => {
      await page.click(`[data-share="${idx}"]`); await page.waitForSelector(`#shareOut${idx} img`);
      const info = await page.evaluate(async () => { const b = window.PSRLevelUI.state.share.blob; const bm = await createImageBitmap(b); const buf = new Uint8Array(await b.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { w: bm.width, h: bm.height, type: b.type, b64: btoa(s) }; });
      ok(info.w === 1080 && info.h === 1920 && info.type === "image/png", `${tag}: story image is a 1080x1920 PNG (${file})`);
      ok(!!(await page.$(`#shareOut${idx} a[download]`)), `${tag}: story download offered`);
      if (SHOTS) require("fs").writeFileSync(`${SHOTS}/${file}`, Buffer.from(info.b64, "base64"));
    };
    const overflow = async (name) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= vw, `${tag}: no horizontal overflow (${name}, ${w}px)`); };

    // 0. Hero
    await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" }); await page.waitForSelector('form[data-step="1"]');
    const hero = await page.evaluate(() => ({ h1: document.querySelector(".lvl-intro h1").textContent, lead: document.querySelector(".lvl-intro .lead").textContent, meta: document.querySelector(".lvl-meta").textContent, pills: document.querySelectorAll(".lvl-promise").length, heroBottom: document.querySelector(".lvl-intro").getBoundingClientRect().bottom, formTop: document.querySelector('form[data-step="1"]').getBoundingClientRect().top, firstField: document.querySelector("#f_age").getBoundingClientRect().bottom, vh: innerHeight }));
    ok(hero.h1 === "Find My Level" && hero.lead === "Enter your numbers and see how they compare with published college baseball benchmarks." && hero.meta === "Free · About 2 minutes · No sign-up" && hero.pills === 0, `${tag}: hero title, line and small line; pill badges removed`);
    ok(hero.heroBottom < hero.vh, `${tag}: hero fits in under one screen (${Math.round(hero.heroBottom)}px of ${hero.vh})`);
    ok(hero.formTop < hero.vh && hero.firstField <= hero.vh, `${tag}: step 1 visible on the first screen (first field ends at ${Math.round(hero.firstField)}px)`);
    if (SHOTS && mobile) await page.screenshot({ path: `${SHOTS}/phone-hero-step1.png` });
    await overflow("hero");

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
    ok(lowTxt.includes("No published target") && !lowTxt.includes("No published benchmark") && lowTxt.includes("data gap"), `${tag}: Lower D1 shown as "No published target", not a negative`);
    ok((await catText(page, 0, "p4")).toLowerCase().includes("second source"), `${tag}: second published source shown separately`);
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
      ok(!!(await page.$('[data-panel="FG"]')) && (await page.textContent('[data-panel="FG"]')).includes("Outfielders during or after their junior season"), `${tag}: ${pos} gets the outfielder (Flatground) panel`);
      if (pos === "CF") {
        const cfMain = await mainText(page, 0), cfLv = await levelRow(page, 0);
        console.log("      CF main: " + JSON.stringify(cfMain) + "\n      CF levels: " + cfLv.join(" · "));
        ok(cfMain[0] === "Your results as a center fielder." && cfMain[1] === "Your numbers meet the listed mid-major D1 targets." && cfMain[2] === "Supported by your max exit velocity (94 mph) and 60-yard dash (6.75 s)." && cfMain[3] === "A benchmark comparison, not a prediction. Coaches also weigh game performance and roster needs.", `${tag}: CF title, headline, support and caveat`);
        ok(cfMain[4] === "Next benchmark: Power conference D1. Your 60 is 0.05 s slower than the listed 6.70 s.", `${tag}: CF next step shows only the closest gap`);
        ok(cfLv.join("|") === "Power D1: Close|Mid-major D1: Meets targets|Lower D1: No published target|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets", `${tag}: CF level row lists all seven levels in order`);
        ok(await fitsFirst(), `${tag}: CF headline, next step and CTA fit the first results screen`);
        const mainV = await page.evaluate(() => { const p = document.querySelector(".lvl-read"); const c = p.cloneNode(true); c.querySelectorAll("details").forEach(d => d.remove()); return c.textContent; });
        ok(!/NextCommit|NCSA|BaseballPath|Flatground|Slammers|guideline|Position read|Missing/i.test(mainV), `${tag}: main view names no sources and never says "missing"`);
        ok((await page.$$("details.lvl-sec")).length === 4 && (await page.$$("details.lvl-sec[open]")).length === 0, `${tag}: four detail sections, all closed by default`);
        ok(!(await page.isVisible(".lvl-legend")), `${tag}: source legend only inside Sources`);
        for (const sct of ["levels", "compare", "sources", "how"]) {
          await page.click(`details[data-sec="${sct}"] > summary`); const o = await page.$eval(`details[data-sec="${sct}"]`, d => d.open);
          await page.click(`details[data-sec="${sct}"] > summary`); const c = await page.$eval(`details[data-sec="${sct}"]`, d => d.open);
          ok(o && !c, `${tag}: "${sct}" section opens and closes`);
        }
        if (SHOTS && mobile) { await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const r = document.querySelector(".lvl-results"); window.scrollTo(0, r.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); }); await page.screenshot({ path: `${SHOTS}/phone-cf-first.png` }); }
        if (mobile) await story(0, "story-cf.png");
        await overflow("CF results");
      }
      if (pos === "CF" && SHOTS) {
        await page.evaluate(() => document.querySelectorAll("details.lvl-sec").forEach(d => d.open = true));
        if (mobile) { await page.screenshot({ path: `${SHOTS}/phone-cf-expanded.png`, fullPage: true }); await overflow("CF expanded"); }
        if (!mobile) { await page.screenshot({ path: `${SHOTS}/desktop-results-cf.png`, fullPage: true }); }
      }
      const t = await catText(page, 0, "p4");
      const runLine = t.split("\n").slice(t.split("\n").findIndex(l => /^Running/.test(l)), t.split("\n").findIndex(l => /^Running/.test(l)) + 4).join(" ");
      ok(runLine.includes(expect) && runLine.includes(pos === "LF" ? "6.7–6.8" : "6.5–6.7"), `${tag}: ${pos} 6.75 uses the ${pos === "LF" ? "Corner OF (6.7–6.8)" : "CF (6.5–6.7)"} target → ${expect}`);
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
    const heads = await page.$$eval(".lvl-res-title", e => e.map(x => x.textContent));
    ok(heads.length === 2 && heads[0] === "Your results as a shortstop." && heads[1] === "Your results as a pitcher.", `${tag}: two separate reads (position and pitching)`);
    const tabs = await page.$$eval("[role=tab]", e => e.map(x => x.textContent + ":" + x.getAttribute("aria-selected")));
    ok(JSON.stringify(tabs) === JSON.stringify(["Shortstop:true", "Pitcher:false"]) && await page.isVisible("#tp0") && !(await page.isVisible("#tp1")), `${tag}: two-way shows Shortstop / Pitcher tabs, one panel at a time`);
    const ssMain = await mainText(page, 0), ssLv = await levelRow(page, 0);
    console.log("      SS main: " + JSON.stringify(ssMain) + "\n      SS levels: " + ssLv.join(" · "));
    ok(ssMain[1] === "Your numbers meet the listed mid-major D1 targets." && ssMain[4] === "Next benchmark: Power conference D1. Your exit velocity is 1 mph short of the listed 91 mph. One other number is also below this target.", `${tag}: SS headline and next step`);
    ok(ssLv.join("|") === "Power D1: Below targets|Mid-major D1: Meets targets|Lower D1: No published target|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets", `${tag}: SS level row`);
    ok(await fitsFirst(), `${tag}: SS headline, next step and CTA fit the first results screen`);
    if (SHOTS && mobile) await page.screenshot({ path: `${SHOTS}/phone-twoway-ss-first.png` });
    await page.click("#tab1");
    ok(await page.isVisible("#tp1") && !(await page.isVisible("#tp0")), `${tag}: Pitcher tab switches panels`);
    const pMain = await mainText(page, 1), pLv = await levelRow(page, 1);
    console.log("      P main: " + JSON.stringify(pMain) + "\n      P levels: " + pLv.join(" · "));
    ok(pMain[1] === "Your fastball meets the listed lower D1 velocity target." && pMain[4] === "Next benchmark: Mid-major D1. Your fastball is 2 mph short of the listed 88 mph.", `${tag}: P headline and next step`);
    ok(pLv.join("|") === "Power D1: Below targets|Mid-major D1: Below targets|Lower D1: Meets targets|D2: Meets targets|D3: Meets targets|NAIA: Meets targets|JUCO: Meets targets", `${tag}: P level row`);
    if (SHOTS && mobile) {
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const r = document.querySelector(".lvl-results"); window.scrollTo(0, r.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); });
      await page.screenshot({ path: `${SHOTS}/phone-twoway-p-first.png` });
      await story(1, "story-twoway-p.png");
      await page.click("#tab0"); await story(0, "story-twoway-ss.png");
      await page.evaluate(() => document.querySelectorAll('#tp0 [data-sec="levels"], #tp0 [data-sec="compare"]').forEach(d => d.open = true));
      await page.screenshot({ path: `${SHOTS}/phone-twoway-ss-expanded.png`, fullPage: true });
    }
    await overflow("two-way results");
    ok(await page.isVisible("text=never blended into one result"), `${tag}: two-way explanation shown`);
    if (SHOTS && !mobile) await page.screenshot({ path: `${SHOTS}/desktop-results-twoway.png`, fullPage: false });

    // 6. Missing benchmarks: 1B with elite numbers still needs more info
    await start(page, { primary: "1B" });
    await numbers(page, { maxEv: 100, sixty: 6.6, ifVelo: 88 }); await next(page); await evidence(page, {});
    ok(await page.isVisible("text=More information needed for an overall range"), `${tag}: 1B shows "More information needed" (no corner-IF running targets)`);
    ok((await catText(page, 0, "p4")).includes("No published target"), `${tag}: 1B running shows "No published target"`);

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
