// Playwright check for the admin "Level reviews" tab. Uses a fake, locally stored session and
// mocked Supabase responses only: no real login, no real data, nothing is written anywhere.
// Run: NODE_PATH=/path/to/node_modules node tests/admin.reviews.ui.js <base-url> [screenshot-dir]
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "http://127.0.0.1:8799/peach-state-recruits/").replace(/\/?$/, "/");
const SHOTS = process.argv[3] || "";
let pass = 0, fail = 0; const failures = [];
const ok = (c, n) => { if (c) pass++; else { fail++; failures.push(n); } console.log(`${c ? "  ok  " : "  FAIL"} ${n}`); };
const REF = "eqghenbqsbvifzkzkdwf", UID = "00000000-0000-4000-8000-000000000001";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", exp, email: "owner@example.test" })}.test`;
const session = { access_token: jwt, refresh_token: "test", token_type: "bearer", expires_in: 86400, expires_at: exp, user: { id: UID, aud: "authenticated", role: "authenticated", email: "owner@example.test", app_metadata: {}, user_metadata: {} } };
const now = Date.now();
let rows = [
  { id: "11111111-1111-4111-8111-111111111111", created_at: new Date(now - 36e5).toISOString(), ig_handle: "test.player27", grad_year: 2027, positions: "CF", throws: "R", bats: "L", metrics: { maxEv: 96, sixty: 6.75, ofVelo: 88 }, methods: { sixty: "laser", ev: "game", evDevice: "trackman", veloDevice: "pocket", date: "2026-07-20", source: "event" }, headline: "Your numbers meet the listed mid-major D1 targets.", data_version: "1.0", status: "new", owner_note: null },
  { id: "22222222-2222-4222-8222-222222222222", created_at: new Date(now - 864e5).toISOString(), ig_handle: "sample_rhp28", grad_year: 2028, positions: "P", throws: "R", bats: "R", metrics: { maxFb: 86, typFb: 84, fbSpin: 2250, bbSpin: 2450 }, methods: { pitchDevice: "rapsodo", veloDevice: "pocket", grade: "10" }, headline: "Your fastball meets the listed lower D1 velocity target.", data_version: "1.0", status: "contacted", owner_note: null }
];
(async () => {
  const browser = await chromium.launch();
  for (const [vw, tag, mobile] of [[1440, "desktop", false], [390, "phone", true]]) {
    console.log(`\n== admin ${tag} ${vw}px ==`);
    const ctx = await browser.newContext({ viewport: { width: vw, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const updates = [];
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) {} }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
    await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
      const u = new URL(route.request().url()), m = route.request().method();
      const json = (b, s) => route.fulfill({ status: s || 200, contentType: "application/json", body: JSON.stringify(b) });
      if (u.pathname.startsWith("/auth/v1/user")) return json(session.user);
      if (u.pathname.startsWith("/auth/v1/")) return json({});
      if (u.pathname.startsWith("/functions/v1/")) return json({ accounts: [] });
      if (u.pathname === "/rest/v1/admins") return json([{ user_id: UID }]);
      if (u.pathname === "/rest/v1/level_reviews") {
        if (m === "PATCH") { const id = (u.searchParams.get("id") || "").replace(/^eq\./, ""); const body = JSON.parse(route.request().postData() || "{}"); updates.push({ id, body }); return route.fulfill({ status: 204, body: "" }); }
        return json(rows);
      }
      if (u.pathname === "/rest/v1/player_of_week") return json(null);
      return json([]);
    });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e)));
    await page.goto(BASE + "admin.html", { waitUntil: "networkidle" });
    await page.waitForSelector("#levelReviews .lr-card", { timeout: 15000 }).catch(() => {});
    ok(await page.isVisible('.dash-tabs a[href="#levelReviews"]') && (await page.textContent('.dash-tabs a[href="#levelReviews"]')) === "Level reviews", `${tag}: "Level reviews" tab in admin.html`);
    const cards = await page.$$eval("#levelReviews .lr-card", e => e.map(x => x.innerText));
    ok(cards.length === 2 && /@test\.player27/.test(cards[0]) && /CF · 2027/.test(cards[0]) && /Max EV 96 mph/.test(cards[0]) && /sixty: laser/.test(cards[0]) && /mid-major/.test(cards[0]), `${tag}: reviews listed newest first with handle, class, position, numbers, methods and headline`);
    ok(/1 new/.test(await page.textContent("#lrCount")), `${tag}: new count shown`);
    await page.selectOption('[data-lr-status="11111111-1111-4111-8111-111111111111"]', "contacted");
    await page.waitForTimeout(300);
    ok(updates.length === 1 && updates[0].body.status === "contacted", `${tag}: status update sent for that row only`);
    ok(!(await page.evaluate(() => [...document.querySelectorAll(".nav a, .mobile-menu a, footer a")].some(a => /admin/.test(a.getAttribute("href") || "")))) , `${tag}: admin not linked from the public nav`);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.getElementById("levelReviews").scrollIntoView(); });
    await page.waitForTimeout(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-admin-level-reviews.png` });
    ok(errs.length === 0, `${tag}: no page errors${errs.length ? " → " + errs.join(" | ") : ""}`);
    rows = rows.map(r => r.id.startsWith("1111") ? Object.assign({}, r, { status: "new" }) : r);
    await ctx.close();
  }
  await browser.close();
  console.log(`\nAdmin UI tests: ${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failures:\n- " + failures.join("\n- ")); process.exit(1); }
})();
