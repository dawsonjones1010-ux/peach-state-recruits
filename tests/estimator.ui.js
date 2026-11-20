// Legacy v21 visual-contract suite. The v22 report intentionally changes these layouts/copy.
// Run npm run test:ui for the current v22 real-browser acceptance suite.
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
  await page.selectOption("#f_gradYear", String(s.grad || 2027));
  await page.selectOption("#f_primary", s.primary);
  if (s.secondary) await page.selectOption("#f_secondary", s.secondary);
  if (!s.noHW) { const h = s.h || 72; await page.selectOption("#f_heightIn", String(Math.floor(h / 12))); await page.selectOption('select[data-h="in"]', String(h % 12)); await page.fill("#f_weightLb", String(s.w || 180)); }
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
    // The opt-in review is the only allowed outside call, and only after "Send" is tapped. It is mocked here.
    let sendTapped = false; const reviewBodies = [];
    await ctx.route("**/rest/v1/level_reviews*", (route) => { reviewBodies.push({ tapped: sendTapped, body: route.request().postData(), prefer: route.request().headers()["prefer"] }); route.fulfill({ status: 201, body: "" }); });
    page.on("request", r => { if (!/find-my-level/.test(page.url())) return; if (sendTapped && /\/rest\/v1\/level_reviews/.test(r.url()) && r.method() === "POST") return; const same = r.url().startsWith(BASE) || r.url().startsWith("blob:") || /fonts\.(googleapis|gstatic)\.com/.test(r.url()); if (r.method() !== "GET" || !same) posts.push(r.method() + " " + r.url()); });
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
    const hero = await page.evaluate(() => ({ h1: document.querySelector(".lvl-intro h1").textContent, lead: document.querySelector(".lvl-intro .lead").textContent, meta: document.querySelector(".lvl-meta").textContent, pills: document.querySelectorAll(".lvl-promise").length, heroBottom: document.querySelector(".lvl-intro").getBoundingClientRect().bottom, formTop: document.querySelector('form[data-step="1"]').getBoundingClientRect().top, firstField: document.querySelector("#f_gradYear").getBoundingClientRect().bottom, vh: innerHeight }));
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
    const resMain = await page.evaluate(() => { const c = document.querySelector(".lvl-results").cloneNode(true); c.querySelectorAll('[data-sec="sources"], .lvl-print').forEach(e => e.remove()); return c.textContent; });
    ok(!/probability|percentile|fit score|% chance/i.test(resMain), `${tag}: no fabricated scores or probabilities (the Sources list may name published studies)`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-results-ss.png`, fullPage: !mobile ? false : false });
    // Update my numbers keeps values
    await page.click("text=Update my numbers"); await page.waitForSelector('form[data-step="1"]');
    ok((await page.inputValue("#f_gradYear")) === "2027" && !(await page.$("#f_age")) && (await page.inputValue("#f_primary")) === "SS", `${tag}: "Update my numbers" keeps entries`);
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

    // ===== v17: Part 4 test players (CF 2027, 2028 RHP 86 + spin, 2029 freshman, two-way SS/P, all blank) =====
    const sel = async (id, v) => { await page.evaluate(() => document.querySelectorAll("details.lvl-more").forEach(d => d.open = true)); await page.selectOption(id, v); };
    const toResults = async () => page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const r = document.querySelector(".lvl-results"); window.scrollTo(0, r.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); });
    const panelShot = async (sel, file) => { const bb = await page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { x: Math.max(0, r.left - 6), y: r.top + scrollY - 6, width: Math.min(innerWidth, r.width + 12), height: r.height + 12 }; }, sel); await page.screenshot({ path: file, fullPage: true, clip: bb }); };
    const shot = async (name, full) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, fullPage: !!full }); };
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    // P1: CF, class of 2027
    await start(page, { primary: "CF", grad: 2027 });
    ok(!(await page.$("#f_age")) && !(await page.isVisible("text=Age when measured")), `${tag}: no age field anywhere (grad year only)`);
    await numbers(page, { maxEv: 94, sixty: 6.75, ofVelo: 88 });
    await sel("#f_m_sixty", "laser"); await sel("#f_m_ev", "game"); await sel("#f_m_evDevice", "trackman"); await sel("#f_m_veloDevice", "pocket");
    await next(page);
    ok(await page.isVisible("#f_grade") && (await page.textContent('label[for="f_grade"]')).includes("What grade were you in when you got these numbers?"), `${tag}: step 3 asks the grade question`);
    await evidence(page, { date: "2026-07-20", environment: "showcase", method: "electronic", source: "event" });
    let tx = await page.textContent("#tp0");
    ok(/Laser/.test(await page.textContent("#tp0 .lvl-nums")) && /TrackMan/.test(await page.textContent("#tp0 .lvl-nums")) && /Game/.test(await page.textContent("#tp0 .lvl-nums")), `${tag}: method chips shown next to each number`);
    ok((await page.textContent(".lvl-cta2-s")) === "Your bat and speed already meet the listed mid-major D1 targets. Coaches still need to see them on film." && (await page.getAttribute(".lvl-cta2 a", "href")) === "index.html#packages", `${tag}: CTA sentence chosen by the result, links to packages`);
    ok(await page.isVisible(".lvl-cta"), `${tag}: bottom CTA kept`);
    const clk = await page.textContent(".lvl-clock");
    ok(/Your recruiting clock/.test(clk) && /D1, D2, D3, NAIA and JUCO coaches can contact you now/.test(clk) && /one state's data/.test(clk) && /NAIA/.test(clk) && /does not regulate/.test(clk), `${tag}: recruiting clock (2027: all levels open, NAIA rule shown, wave labeled as one state)`);
    ok(!(await page.$(".lvl-young")) , `${tag}: no sophomore panel for junior-year numbers`);
    ok(/First saved result/.test(await page.textContent(".lvl-prog")) && await page.isVisible("text=Clear my saved results"), `${tag}: progress saved, clear button shown`);
    ok((await page.$$eval(".lvl-privacy", e => e.map(x => x.textContent))).includes("Nothing leaves your browser unless you tap Send."), `${tag}: privacy line`);
    ok(await fitsFirst(), `${tag}: CF 2027 headline, next step and CTA fit the first results screen`);
    await toResults(); await shot("p1-cf2027-first"); await shot("p1-cf2027-full", true);
    // Progress on return
    await page.click("text=Update my numbers"); await page.waitForSelector('form[data-step="1"]'); await next(page);
    await page.fill("#f_maxEv", "96"); await next(page); await evidence(page, {});
    const pr = await page.textContent(".lvl-prog");
    ok(/Since last time/.test(pr) && /\+2 mph max exit velocity since/.test(pr) && (await page.$$(".lvl-prog svg.lvl-spark")).length >= 1, `${tag}: "Since last time" change and sparkline on return`);
    await page.evaluate(() => document.querySelector(".lvl-prog").scrollIntoView({ block: "center" })); await shot("p1-cf2027-progress");
    // Opt-in review: nothing sent until Send is tapped
    ok(reviewBodies.length === 0, `${tag}: nothing sent before Send`);
    await page.click("[data-review-open]"); await page.fill("#f_igHandle", "bad handle!"); sendTapped = true; await page.click("[data-review-send]");
    ok(await page.isVisible("#reviewErr") && reviewBodies.length === 0, `${tag}: invalid handle is not sent`);
    await page.fill("#f_igHandle", "@test.player27"); await page.click("[data-review-send]"); await page.waitForSelector(".lvl-review-ok");
    const rb = reviewBodies[0] ? JSON.parse(reviewBodies[0].body) : {};
    ok(reviewBodies.length === 1 && reviewBodies[0].tapped && reviewBodies[0].prefer === "return=minimal" && rb.ig_handle === "test.player27" && rb.positions === "CF" && rb.grad_year === 2027 && rb.metrics.maxEv === 96 && rb.methods.sixty === "laser" && /mid-major/.test(rb.headline) && !("age" in rb), `${tag}: review sends handle, class, position, numbers, method chips and headline only after tapping Send`);
    await page.evaluate(() => document.querySelector(".lvl-review").scrollIntoView({ block: "center" })); await shot("p1-review-sent");
    sendTapped = false;
    // Print: one clean page
    await page.emulateMedia({ media: "print" });
    const prt = await page.evaluate(() => ({ print: getComputedStyle(document.querySelector(".lvl-print")).display, others: [...document.querySelectorAll(".lvl-results > :not(.lvl-print)")].every(e => getComputedStyle(e).display === "none"), nav: getComputedStyle(document.querySelector(".nav")).display }));
    ok(prt.print === "block" && prt.others && prt.nav === "none", `${tag}: print layout shows only the one-page sheet`);
    if (!mobile) { const pdf = await page.pdf({ format: "Letter", printBackground: true }); const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length; ok(pages === 1, `${tag}: print is one page (${pages})`); if (SHOTS) require("fs").writeFileSync(`${SHOTS}/print-cf2027.pdf`, pdf); await page.screenshot({ path: `${SHOTS}/desktop-print-preview.png`, fullPage: true }); }
    await page.emulateMedia({ media: "screen" });
    await page.click("[data-clear-history]");
    ok(!(await page.$(".lvl-prog")) && (await page.evaluate(() => localStorage.getItem("psr_fml_history_v1"))) === null, `${tag}: "Clear my saved results" clears localStorage`);

    // P2: 2028 RHP, 86 mph with spin, sophomore-year numbers
    await start(page, { primary: "P", throws: "R", grad: 2028 });
    await numbers(page, { maxFb: 86, typFb: 84 });
    await page.evaluate(() => document.querySelectorAll("details.lvl-more").forEach(d => d.open = true));
    await numbers(page, { fbSpin: 2250, bbSpin: 2450, extension: 6.1, ivb: 16.5 });
    await sel("#f_pitchDevice", "rapsodo"); await sel("#f_m_veloDevice", "pocket");
    await next(page); await evidence(page, { date: "2026-06-10", environment: "showcase", method: "radar", source: "event" });
    const yg = await page.textContent("#tp0 .lvl-young");
    ok(/When they were your age/.test(yg) && yg.includes("Your 86 mph peak sits between the 16th and 50th percentile of Indiana's eventual D1 arms as sophomores.") && /Indiana/.test(yg) && /n /.test(yg), `${tag}: RHP 86 sophomore panel with the in-sample band, state and sample size`);
    ok(!/18 eventual D1 signees/.test(yg), `${tag}: under-85 fact not shown at 86`);
    ok(/Pocket Radar/.test(await page.textContent("#tp0 .lvl-nums")), `${tag}: velo device chip`);
    await page.evaluate(() => { const d = document.querySelector('#tp0 [data-sec="compare"]'); d.open = true; });
    const adv = await page.textContent('[data-panel="advanced"]');
    ok(/Fastball spin/.test(adv) && /Breaking-ball spin/.test(adv) && /No published level comparison/.test(adv) && /Rapsodo/.test(adv) && /never change your level/.test(adv), `${tag}: advanced pitch numbers compared as context only`);
    ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(["low", "d2", "d3", "naia", "juco"]), `${tag}: spin and sophomore data do not change the highlighted levels`);
    await page.evaluate(() => { const d = document.querySelector('#tp0 [data-sec="compare"]'); d.open = false; });
    await toResults(); await shot("p2-rhp2028-first");
    await page.evaluate(() => { document.querySelector('#tp0 [data-sec="compare"]').open = true; }); await shot("p2-rhp2028-full", true);
    if (mobile) await story(0, "story-rhp2028.png");
    await overflow("RHP 2028 results");

    // P3: class of 2029 freshman
    await start(page, { primary: "SS", grad: 2029 });
    await numbers(page, { maxEv: 82, sixty: 7.3, ifVelo: 74 }); await next(page);
    await page.selectOption("#f_grade", "9"); await evidence(page, { date: "2026-10-01" });
    ok(/No freshman-year data has been published/.test(await page.textContent("#tp0")) && !(await page.$(".lvl-young")), `${tag}: freshman gets the short line, no panel`);
    const c29 = await page.textContent(".lvl-clock");
    ok(/D3, NAIA and JUCO coaches can contact you now/.test(c29) && /D1 and D2: not yet/.test(c29) && /June 15, 2027/.test(c29) && /\d+\s*days/.test(c29), `${tag}: 2029 clock: open levels, next key date with countdown`);
    await toResults(); await shot("p3-fr2029-first"); await shot("p3-fr2029-full", true);

    // P4: two-way SS/P, sophomore numbers, hand-timed 60
    await start(page, { primary: "SS", secondary: "P", grad: 2028 });
    await numbers(page, { maxFb: 84, maxEv: 90, sixty: 6.9, ifVelo: 84 });
    await sel("#f_m_sixty", "hand"); await next(page);
    await page.selectOption("#f_grade", "10"); await evidence(page, {});
    ok(/Hand times usually read faster than laser times\./.test(await page.textContent("#tp0 .lvl-nums")), `${tag}: hand-timed 60 note`);
    const y0 = await page.textContent("#tp0 .lvl-young");
    ok(/Early D1 commits at SS/.test(y0) && /Early commits only/.test(y0) && /Indiana/.test(y0), `${tag}: SS sophomore panel by position, early commits labeled`);
    ok((await page.$$eval("[role=tab]", e => e.map(x => x.textContent))).join("|") === "Shortstop|Pitcher", `${tag}: two-way tabs`);
    await toResults(); await shot("p4-twoway-ss-first");
    await page.click("#tab1");
    const y1 = await page.textContent("#tp1 .lvl-young");
    ok(/18 eventual D1 signees threw under 85 mph as sophomores; 4 became Power 4 signees/.test(y1), `${tag}: pitcher under 85 sees the 4-of-18 fact`);
    await toResults(); await shot("p4-twoway-p-first"); await shot("p4-twoway-p-full", true);
    await overflow("two-way v2 results");

    // P5: all-blank form
    await start(page, { primary: "CF", grad: 2028 });
    await next(page);
    if (await page.$('form[data-step="2"]')) { await shot("p5-blank-step2"); for (const k of ["maxEv", "sixty", "ofVelo"]) await page.check(`[data-unknown="${k}"]`); await next(page); }
    await evidence(page, {});
    ok(await page.isVisible("text=More information needed for an overall range") && (await page.$$(".lvl-cat.is-hl")).length === 0 && !(await page.$(".lvl-nums")), `${tag}: all-blank form gives no level and no invented numbers`);
    await toResults(); await shot("p5-blank-first"); await shot("p5-blank-full", true);
    await overflow("blank results");

    // ===== v18: Your frame (height and weight required, context only) =====
    await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" }); await page.waitForSelector('form[data-step="1"]');
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
    if (SHOTS) { await page.selectOption("#f_gradYear", "2027"); await page.selectOption("#f_primary", "SS"); await page.selectOption("#f_heightIn", "5"); await page.selectOption('select[data-h="in"]', "10"); await page.fill("#f_weightLb", "170");
      await page.evaluate(() => { const f = document.querySelector('[data-wrap="secondary"]'); window.scrollTo(0, f.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); }); await page.screenshot({ path: `${SHOTS}/${tag}-form-height-weight.png` });
      await page.goto(BASE + "find-my-level.html", { waitUntil: "networkidle" }); await page.waitForSelector('form[data-step="1"]'); }
    const hwUi = await page.evaluate(() => { const h = document.querySelector('[data-wrap="heightIn"]'), w = document.querySelector('[data-wrap="weightLb"]'); const vis = (e) => !!e && e.getBoundingClientRect().height > 0 && !e.closest("details:not([open])"); return { vis: vis(h) && vis(w), opt: /optional/i.test(h.textContent + w.textContent) || /optional/i.test((h.closest(".lvl-hw") || h.parentElement).textContent), req: document.querySelector("#f_heightIn").getAttribute("aria-required") === "true" && document.querySelector("#f_weightLb").getAttribute("aria-required") === "true" }; });
    ok(hwUi.vis && !hwUi.opt && hwUi.req, `${tag}: height and weight shown on step 1 as required (no "optional" label)`);
    await page.selectOption("#f_gradYear", "2027"); await page.selectOption("#f_primary", "SS");
    await page.$eval("input[name=throws][value=R]", el => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.$eval("input[name=bats][value=R]", el => { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.click("form button[type=submit]"); await page.waitForTimeout(150);
    const hwErr = await page.textContent('form[data-step="1"]');
    ok(!!(await page.$('form[data-step="1"]')) && hwErr.includes("Enter height (feet and inches).") && hwErr.includes("Enter weight in pounds."), `${tag}: blank height and weight block step 1 with friendly errors`);
    if (SHOTS) { await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.querySelector('[data-wrap="heightIn"]').scrollIntoView({ block: "center" }); }); await page.screenshot({ path: `${SHOTS}/${tag}-form-height-weight-errors.png` }); }
    await page.selectOption("#f_heightIn", "5"); await page.selectOption('select[data-h="in"]', "10"); await page.fill("#f_weightLb", "170");
    await page.click("form button[type=submit]"); await page.waitForSelector('form[data-step="2"]');
    await numbers(page, { maxEv: 90, sixty: 6.9, ifVelo: 84 }); await next(page); await evidence(page, {});
    const hlSS = await hlCats(page, 0);
    const fr = await page.textContent("#tp0 .lvl-frame");
    ok(/Your frame/.test(fr) && fr.includes("At 5'10\", 170 you're about 2 inches under the average college position player below Power 4.") && !/too (small|big)/i.test(fr), `${tag}: 5'10" 170 SS frame headline`);
    ok(fr.includes("College averages come from listed roster heights and weights of players aged 18–23. They show the bodies players grow into, not a requirement. About 1 in 3 college players below Power 4 is under 6'0\".") && /About this data/.test(fr) && !(await page.$eval("#tp0 .lvl-about", d => d.open)), `${tag}: frame note always shown, "About this data" collapsed`);
    ok((await page.$$eval("#tp0 .lvl-frame-t tbody tr", t => t.map(r => r.querySelector("th").textContent))).join("|") === "Power 4|Mid-major D1|Lower D1|D2|D3|NAIA|JUCO" && /one team \(Jones College\)/.test(fr), `${tag}: frame table lists all 7 levels, JUCO weight one-team note`);
    ok((await page.$$eval("#tp0 .lvl-frame-t thead th", t => t.map(x => x.childNodes[0].textContent.trim()))).join("|") === "Level|You|Committed high school players|College rosters now", `${tag}: frame columns`);
    ok(/PSR_College_Roster_Size_Sample_2026\.csv/.test(await page.innerHTML('[data-sec="sources"]')), `${tag}: roster CSV linked from Sources`);
    if (SHOTS) { await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const e = document.querySelector("#tp0 .lvl-frame"); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); }); await page.screenshot({ path: `${SHOTS}/${tag}-frame-ss-5-10-170.png` }); await panelShot("#tp0 .lvl-frame", `${SHOTS}/${tag}-frame-ss-5-10-170-panel.png`); }
    // Same numbers, different body: level result identical
    await page.click("text=Update my numbers"); await page.waitForSelector('form[data-step="1"]');
    await page.selectOption("#f_heightIn", "6"); await page.selectOption('select[data-h="in"]', "5"); await page.fill("#f_weightLb", "240");
    await next(page); await next(page); await evidence(page, {});
    ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(hlSS) && hlSS.length > 0, `${tag}: changing height and weight never changes the highlighted levels (${hlSS.join(",")})`);
    for (const [h, w, nm, re] of [[75, 205, "rhp-6-3-205", /At 6'3", 205 you're right around the Power 4 roster average for a pitcher\./], [76, 215, "rhp-6-4-215", /At 6'4", 215 you're taller than the average college pitcher at every level, Power 4 included\./]]) {
      await start(page, { primary: "P", throws: "R", grad: 2028, h, w });
      await numbers(page, { maxFb: 86 }); await next(page);
      await page.selectOption("#f_grade", "10"); await evidence(page, {});
      const f = await page.textContent("#tp0 .lvl-frame");
      ok(re.test(f) && /College rosters now\s*\(pitchers\)/.test(f) && f.includes(`6'2.9", 209`), `${tag}: ${nm} frame uses the college pitcher rows`);
      ok(/57\.4% of eventual D1 pitchers who were 6'2" or taller as sophomores signed Power 4, vs 34% of shorter ones/.test(f) && /velocity and spin mattered more/.test(f), `${tag}: ${nm} sophomore pitcher sees the PBR Indiana height fact`);
      ok(JSON.stringify(await hlCats(page, 0)) === JSON.stringify(["low", "d2", "d3", "naia", "juco"]), `${tag}: ${nm} highlight unchanged by size`);
      if (SHOTS) { await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; const e = document.querySelector("#tp0 .lvl-frame"); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - document.querySelector(".nav").offsetHeight - 8); }); await page.screenshot({ path: `${SHOTS}/${tag}-frame-${nm}.png` }); await panelShot("#tp0 .lvl-frame", `${SHOTS}/${tag}-frame-${nm}-panel.png`);
        if (nm === "rhp-6-3-205") { await page.evaluate(() => { document.querySelector("#tp0 .lvl-about").open = true; }); await panelShot("#tp0 .lvl-frame", `${SHOTS}/${tag}-frame-${nm}-panel-about-open.png`); await page.evaluate(() => { document.querySelector("#tp0 .lvl-about").open = false; }); } }
      await overflow(`frame ${nm}`);
    }
    // Outfielder: Flatground column, D1 tiers kept separate
    await start(page, { primary: "CF", h: 72, w: 180 });
    await numbers(page, { maxEv: 94, sixty: 6.75, ofVelo: 88 }); await next(page); await evidence(page, {});
    const fcf = await page.textContent("#tp0 .lvl-frame");
    ok(/\(OF\)/.test(fcf) && /outfielder report's D1 tiers/.test(fcf) && fcf.includes("At 6'0\", 180 you're right around the Mid-major D1–JUCO roster average for a position player."), `${tag}: outfielder gets Flatground next to Slammers`);
    // Two-way: position rows on the SS tab, pitcher rows on the P tab
    await start(page, { primary: "SS", secondary: "P", h: 73, w: 185 });
    await numbers(page, { maxFb: 86, maxEv: 90, sixty: 6.9, ifVelo: 84 }); await next(page); await evidence(page, {});
    ok(/\(position players\)/.test(await page.textContent("#tp0 .lvl-frame")) && /\(pitchers\)/.test(await page.$eval("#tp1 .lvl-frame", e => e.textContent)), `${tag}: two-way uses position rows and pitcher rows per tab`);

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
    const homeCard = await page.textContent("#find-my-level p");
    ok(homeCard.trim() === "Enter your exit velo, 60 time, fastball, arm or pop time and see how you compare with published college benchmarks, from D1 to JUCO. Free, about 2 minutes.", `${tag}: homepage Find My Level card text`);
    // Owner decision (Nov 20, 2026): the $129 Recruiting Starter Kit is retired; Elite now lists a schedule graphic.
    const plans = await page.evaluate(() => [...document.querySelectorAll("#pricing .plan")].map(e => ({ id: e.id, t: e.innerText })));
    ok(plans.map(p => p.id).join(",") === "plan-basic,plan-pro,plan-elite" && !plans.some(p => /Starter Kit|\$129/i.test(p.t)), `${tag}: three plans (Basic, Pro, Elite), no Starter Kit`);
    ok(/Schedule graphic/.test(plans[2].t) && /\$99/.test(plans[2].t), `${tag}: Elite $99 lists Schedule graphic`);
    ok((await page.evaluate(() => [...document.querySelectorAll(".plan .price")].map(p => p.textContent).join("|"))) === "$25one time|$49one time|$99one time", `${tag}: existing prices unchanged`);
    ok(await page.evaluate(() => { const s = document.getElementById("parents"); return s && s.hidden && s.querySelectorAll(".quote").length === 3 && s.previousElementSibling.id === "examples"; }), `${tag}: "What parents say" section (3 cards) after examples, hidden`);
    await overflow("homepage");
    if (mobile) {
      ok(await page.evaluate(() => getComputedStyle(document.querySelector(".hx-grid")).gridTemplateColumns.split(" ").length === 1 && document.querySelector(".hx-copy").scrollWidth <= innerWidth), `${tag}: hero grid is one minmax(0,1fr) column`);
      for (const y of [0, 600, 1100]) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(350); const vis = await page.evaluate(() => { const s = document.getElementById("stickyCta"); const r = s.getBoundingClientRect(); return getComputedStyle(s).display !== "none" && r.top < innerHeight && s.classList.contains("show"); }); ok(!vis, `${tag}: floating "See packages" box hidden in the hero (scroll ${y})`); }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-home-hero.png` });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.getElementById("find-my-level").scrollIntoView(); }); await page.waitForTimeout(400);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-home-fml-card.png` });
      await page.evaluate(() => { document.getElementById("packages").scrollIntoView(); document.querySelectorAll(".reveal").forEach(e => e.classList.add("in")); }); await page.waitForTimeout(500);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-packages.png`, fullPage: false });
      if (SHOTS) await page.evaluate(() => document.getElementById("plan-elite").scrollIntoView({ block: "center" }));
      if (SHOTS) { await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}/phone-packages-elite.png` }); }
    } else if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/desktop-home-hero.png` });
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.getElementById("packages").scrollIntoView(); document.querySelectorAll(".reveal").forEach(e => e.classList.add("in")); }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/desktop-packages.png` });
    }
    await page.goto(BASE + "players.html", { waitUntil: "networkidle" });
    ok(/players?/.test(await page.textContent("#count")), `${tag}: players page still works`);
    await overflow("players page");
    if (mobile) ok(await page.evaluate(() => [...document.querySelectorAll(".photo-frame-bg")].every(e => e.getBoundingClientRect().right <= innerWidth + 1)), `${tag}: players .photo-frame-bg stays inside the 390px viewport`);
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
