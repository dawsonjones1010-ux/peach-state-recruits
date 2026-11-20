// Playwright UI tests for the recruiting tools (College Finder, My Recruiting, Camps, Admin).
// Runs against the local preview backend (?demo=1), so no real accounts or emails are used.
// Run: NODE_PATH=/path/to/node_modules node tests/recruiting.ui.js <base-url> [screenshot-dir]
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:8099/").replace(/\/?$/, "/");
const SHOTS = process.argv[3] || "";
let pass = 0, fail = 0; const failures = [];
const ok = (cond, name) => { if (cond) pass++; else { fail++; failures.push(name); } console.log(`${cond ? "  ok  " : "  FAIL"} ${name}`); };
const FONT_CSS = "@font-face{font-family:'Anton';src:local('DejaVu Sans Condensed Bold');}";

async function newPage(browser, width, errors) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  await ctx.route("https://fonts.googleapis.com/**", r => r.fulfill({ status: 200, contentType: "text/css", body: FONT_CSS }));
  await ctx.route("https://fonts.gstatic.com/**", r => r.fulfill({ status: 404, body: "" }));
  await ctx.route("https://cdn.jsdelivr.net/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(String(e)));
  return page;
}
const go = async (page, path) => { await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(500); };
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
async function signIn(page, email) {
  await page.waitForSelector("#rcGateForm");
  await page.fill('#rcGateForm input[name=email]', email);
  const consent = await page.$('#rcGateForm input[name=consent]'); if (consent) await consent.check();
  await page.click('#rcGateForm button[type=submit]');
  await page.waitForTimeout(600);
}
async function signOutIfNeeded(page) { const b = await page.$("#signOut"); if (b) { await b.click(); await page.waitForTimeout(400); } }
const count = (page, sel) => page.$$eval(sel, els => els.length);
async function submitDialog(page, formId, fill) {
  await page.waitForSelector(`dialog[open] #${formId}`);
  if (fill) await fill();
  await page.click(`dialog[open] #${formId} button[value=ok]`);
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const errors = [];
  const page = await newPage(browser, 1280, errors);

  // ---------- College Finder ----------
  await go(page, "colleges.html?demo=1");
  await page.waitForSelector(".rc-card");
  const total = await page.$eval("body", b => b.innerText.match(/([\d,]+)\s+programs?/i)?.[1] || "");
  ok(/1,?6\d\d/.test(total), `directory lists all programs (${total})`);
  await page.fill("#fQ", "University of Georgia"); await page.waitForTimeout(400);
  ok((await page.$eval(".rc-card h3", h => h.textContent)).includes("Georgia"), "search finds University of Georgia");
  await page.click(".rc-card [data-save]");
  ok(await page.$("dialog[open] #rcGateForm") !== null || await page.$("#rcGateForm") !== null, "saving while signed out asks to sign in");
  await signIn(page, "player.a@example.com");
  await page.waitForTimeout(300);
  const saveBtn = await page.$(".rc-card [data-save]");
  if ((await saveBtn.getAttribute("aria-pressed")) !== "true") { await saveBtn.click(); await page.waitForTimeout(400); }
  ok((await page.$eval(".rc-card [data-save]", b => b.getAttribute("aria-pressed"))) === "true", "player A saves a school");
  await page.click(".rc-card h3 a"); await page.waitForTimeout(500);
  const detail = await page.$eval("body", b => b.innerText);
  ok(/roster/i.test(detail) && /Checked/i.test(detail), "school detail shows official roster link and checked date");
  ok(/College Scorecard/i.test(detail), "school detail links College Scorecard when academics are missing");
  ok(!/@[a-z0-9-]+\.(edu|com)/i.test(detail.replace(/player\.a@example\.com/g, "")), "school detail shows no coach contact emails");
  await shot(page, "colleges-detail-desktop");

  // Find My Level hand-off
  await go(page, "colleges.html?demo=1&levels=NCAA%20D2,NCAA%20D3&from=fml");
  await page.waitForSelector(".rc-card");
  const lv = await page.$$eval(".rc-card .rc-meta", ms => [...new Set(ms.map(m => m.textContent.match(/NCAA D\d|NAIA|JUCO/)?.[0]))]);
  ok(lv.every(l => l === "NCAA D2" || l === "NCAA D3"), `Find My Level levels filter the list (${lv.join(",")})`);
  ok(/not a judgment|for exploring|doesn.t rate/i.test(await page.$eval("body", b => b.innerText)), "Find My Level note says levels are for exploring");

  // ---------- My Recruiting: plan ----------
  await go(page, "my-recruiting.html?demo=1#profile");
  await page.waitForSelector("#prof");
  await page.fill('#prof input[name=first_name]', "Alex");
  await page.fill('#prof input[name=last_name]', "Rivera");
  if (await page.$('#prof select[name=grad_year]')) await page.selectOption('#prof select[name=grad_year]', "2028"); else await page.fill('#prof input[name=grad_year]', "2028");
  await page.click('#prof button.primary'); await page.waitForTimeout(500);
  await go(page, "my-recruiting.html?demo=1#plan");
  await page.waitForSelector(".rc-tasks");
  const nextTasks = await count(page, "h2 + .rc-tasks [data-task]");
  ok(nextTasks === 3, `plan shows 3 next steps (${nextTasks})`);
  ok(/Class of|2028/.test(await page.$eval("aside", a => a.innerText)), "timeline shows class year");
  const firstTitle = await page.$eval("[data-task] h3", h => h.textContent);
  await page.click('[data-task] [data-act=done]'); await page.waitForTimeout(500);
  ok(!(await page.$$eval("h2 + .rc-tasks [data-task] h3", hs => hs.map(h => h.textContent))).includes(firstTitle), "mark done removes the task from next steps");
  const pTitle = await page.$eval("[data-task] h3", h => h.textContent);
  await page.click('[data-task] [data-act=postpone]');
  await submitDialog(page, "pp");
  ok(!(await page.$$eval("h2 + .rc-tasks [data-task] h3", hs => hs.map(h => h.textContent))).includes(pTitle), "postpone hides the task until its date");
  await page.fill('#addTask input[name=title]', "Ask coach for a recommendation");
  await page.fill('#addTask input[name=due_on]', "2026-11-01");
  await page.click('#addTask button'); await page.waitForTimeout(500);
  ok((await page.$eval("body", b => b.innerText)).includes("Ask coach for a recommendation"), "custom task is added");
  await shot(page, "plan-desktop");

  // ---------- Emails + tracker ----------
  await go(page, "my-recruiting.html?demo=1#emails");
  await page.waitForSelector("#emailContext");
  ok((await page.inputValue('#emailContext input[name=school]')).includes('Georgia'), "composer preselects the saved school");
  const body = await page.inputValue('#ecBody');
  ok(/Alex/.test(body) && /2028/.test(body), "introduction draft uses the player's profile");
  ok(!/\{\{|undefined|null/.test(body), "draft has no invalid values");
  ok(await page.$('#ecOpen') !== null, "email app review control is available");
  await page.click("#ecSent");
  await page.waitForSelector('#ecSentForm');
  await page.fill('#ecSentForm input[name=followOn]', '2026-12-01');
  await page.click('#ecSentForm button[type=submit]');
  await page.waitForTimeout(400);
  await go(page, "my-recruiting.html?demo=1#tracker");
  const trk = await page.$eval("#tab", t => t.innerText);
  ok(/Introduction/i.test(trk) && /Georgia/.test(trk), "tracker logs the sent introduction");
  ok(/follow/i.test(trk), "tracker shows the follow-up reminder");
  await go(page, "my-recruiting.html?demo=1#saved");
  ok(/contacted/i.test(await page.$eval("#tab", t => t.innerText)), "sending moves the school to contacted");

  // ---------- Camps ----------
  await go(page, "camps.html?demo=1");
  await page.waitForSelector(".rc-camp");
  const campText = await page.$eval("body", b => b.innerText);
  ok(/Register on official page/.test(campText), "camps link to official registration");
  ok(/Not named on the official page/.test(campText), "camps don't invent coach names");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-ics]")]);
  const fs = require("fs"); const ics = fs.readFileSync(await dl.path(), "utf8");
  ok(/BEGIN:VCALENDAR/.test(ics) && /DTSTART;VALUE=DATE:\d{8}/.test(ics), "calendar export is a valid .ics");
  await page.click("[data-save]"); await page.waitForTimeout(400);
  await page.click("[data-est]"); await page.waitForTimeout(300);
  ok(await page.$("dialog[open]") !== null, "travel estimate opens");
  await page.keyboard.press("Escape");
  await shot(page, "camps-desktop");

  // ---------- Player B can't see A ----------
  await go(page, "my-recruiting.html?demo=1#saved");
  await signOutIfNeeded(page);
  await go(page, "my-recruiting.html?demo=1#saved");
  await signIn(page, "player.b@example.com");
  await go(page, "my-recruiting.html?demo=1#saved");
  ok(await count(page, "[data-saved]") === 0, "player B sees none of A's saved schools");
  await go(page, "my-recruiting.html?demo=1#tracker");
  ok(!/Georgia/.test(await page.$eval("#tab", t => t.innerText)), "player B sees none of A's messages");
  await go(page, "my-recruiting.html?demo=1#plan");
  ok(!(await page.$eval("body", b => b.innerText)).includes("Ask coach for a recommendation"), "player B sees none of A's tasks");

  // ---------- Admin ----------
  await go(page, "admin-recruiting.html?demo=1");
  ok(!/Import|Programs/.test(await page.$eval("#app", a => a.innerText)) || /not an admin|owner/i.test(await page.$eval("#app", a => a.innerText)), "non-admin can't use the admin page");
  await go(page, "my-recruiting.html?demo=1"); await signOutIfNeeded(page);
  await go(page, "admin-recruiting.html?demo=1");
  await signIn(page, "admin@example.com");
  await go(page, "admin-recruiting.html?demo=1");
  const adm = await page.$eval("#app", a => a.innerText);
  ok(/Programs/.test(adm) && /Camps/.test(adm) && /Import/.test(adm), "admin sees programs, camps and import");
  ok(!/Alex|Rivera|player\.a@/.test(adm), "admin overview shows no private player details");
  await shot(page, "admin-desktop");

  // ---------- Mobile ----------
  const m = await newPage(browser, 390, errors);
  for (const p of ["index.html", "find-my-level.html", "colleges.html?demo=1", "camps.html?demo=1", "my-recruiting.html?demo=1", "admin-recruiting.html?demo=1"]) {
    await go(m, p);
    const sw = await m.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 391, `${p.split("?")[0]} fits a 390px phone (width ${sw})`);
    await shot(m, "mobile-" + p.split(".")[0]);
  }
  await go(m, "index.html");
  const links = await m.$$eval("#mobileMenu a", as => as.map(a => a.getAttribute("href")));
  ok(["colleges.html", "camps.html", "my-recruiting.html"].every(h => links.includes(h)), "home page mobile menu links the new tools");

  ok(errors.length === 0, `no page errors (${errors.slice(0, 3).join(" | ")})`);
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failures:\n - " + failures.join("\n - ")); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
