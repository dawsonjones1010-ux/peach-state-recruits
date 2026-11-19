// Playwright tests for Player of the Week (v14).
// Run: NODE_PATH=/path/to/node_modules node tests/potw.ui.js <site-url> [screenshot-dir]
// The "set" cases use in-browser mocked responses only: nothing is written to the live database.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = (process.argv[2] || "http://127.0.0.1:47613/peach-state-recruits/").replace(/\/?$/, "/");
const SHOTS = process.argv[3] || "";
const cfg = fs.readFileSync(__dirname + "/../config.js", "utf8");
const SB = cfg.match(/supabaseUrl: *"([^"]+)"/)[1], KEY = cfg.match(/supabaseAnonKey: *"([^"]+)"/)[1];
const REF = new URL(SB).hostname.split(".")[0];
let pass = 0, fail = 0; const failures = [];
const ok = (c, n) => { if (c) pass++; else { fail++; failures.push(n); } console.log(`${c ? "  ok  " : "  FAIL"} ${n}`); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

(async () => {
  const pub = await (await fetch(`${SB}/rest/v1/players?published=eq.true&select=*&order=posted_at.desc.nullslast`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })).json();
  const live = await (await fetch(`${SB}/rest/v1/player_of_week?select=*`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })).json();
  const pick = pub.find(p => p.cover_url) || pub[0];
  const TEST = { player_id: pick.id, note: "TEST VALUE: 3-for-4 with a double and two steals in Saturday's opener.", week_of: "2026-11-16" };
  const browser = await chromium.launch();

  for (const [vw, tag, mobile] of [[1440, "desktop", false], [390, "phone", true]]) {
    console.log(`\n== ${tag} ${vw}px ==`);
    const mk = async () => { const ctx = await browser.newContext({ viewport: { width: vw, height: mobile ? 844 : 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile }); const page = await ctx.newPage(); const errs = []; page.on("console", m => { if (m.type() === "error") errs.push(m.text()); }); page.on("pageerror", e => errs.push(String(e))); return { ctx, page, errs }; };

    // 1. Live, nothing set -> hidden
    { const { ctx, page, errs } = await mk();
      await page.goto(BASE, { waitUntil: "networkidle" });
      ok(live.length === 0 || !live[0].player_id ? !(await page.isVisible("#potw")) : await page.isVisible("#potw"), `${tag}: live homepage matches the database (${live.length ? "set" : "nothing set → section hidden"})`);
      ok(errs.length === 0, `${tag}: no console errors on the live homepage${errs.length ? " → " + errs.join(" | ") : ""}`);
      await ctx.close(); }

    // 2. Test value (mocked in the browser) -> rendered
    { const { ctx, page, errs } = await mk();
      await page.route("**/rest/v1/player_of_week*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([TEST]) }));
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.waitForSelector("#potw:not([hidden])", { timeout: 8000 }).catch(() => {});
      const s = await page.evaluate(() => { const e = document.getElementById("potw"); return { vis: !e.hidden, name: e.querySelector("h2")?.textContent, meta: e.querySelector(".potw-meta")?.textContent, note: e.querySelector(".potw-note")?.textContent, week: e.querySelector(".potw-week")?.textContent, links: [...e.querySelectorAll("a")].map(a => a.getAttribute("href")), frame: !!e.querySelector(".potw-media .photo-frame img"), order: [...document.querySelectorAll("main > section, body > section")].map(x => x.id).filter(Boolean).slice(0, 3) }; });
      ok(s.vis && s.name === pick.name, `${tag}: test value renders the picked player's name`);
      ok(s.frame, `${tag}: cover shown through photoFrame`);
      ok((s.meta || "").includes("Class of " + pick.grad_year) && (s.meta || "").includes(pick.position), `${tag}: class and position shown (${s.meta})`);
      ok(s.note === TEST.note && s.week === "Week of Nov 16, 2026", `${tag}: note and week shown`);
      ok(s.links.length === 2 && s.links.every(h => h === "player.html#" + pick.slug), `${tag}: links go to the profile`);
      const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= vw, `${tag}: no horizontal overflow (${w}px)`);
      ok(errs.length === 0, `${tag}: no console errors with a value set${errs.length ? " → " + errs.join(" | ") : ""}`);
      if (SHOTS) { await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; document.querySelectorAll(".reveal").forEach(e => e.classList.add("in")); }); await page.locator("#potw").screenshot({ path: `${SHOTS}/${tag}-homepage-potw-test-value.png` }); }
      // unknown / unpublished id -> hidden
      await page.unroute("**/rest/v1/player_of_week*");
      await page.route("**/rest/v1/player_of_week*", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...TEST, player_id: "00000000-0000-0000-0000-000000000000" }]) }));
      await page.reload({ waitUntil: "networkidle" });
      ok(!(await page.isVisible("#potw")), `${tag}: a player who isn't published never shows`);
      await ctx.close(); }

    // 3. Admin control (mocked owner session and API; no live writes)
    { const { ctx, page, errs } = await mk();
      const uid = "11111111-2222-3333-4444-555555555555";
      const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: uid, role: "authenticated", email: "owner@example.com", exp: 4102444800 })}.sig`;
      const user = { id: uid, aud: "authenticated", role: "authenticated", email: "owner@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify({ access_token: jwt, refresh_token: "x", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user })]);
      const writes = []; let row = null;
      await page.route(u => u.hostname.endsWith("supabase.co"), async r => {
        const u = new URL(r.request().url()), m = r.request().method(), j = (b, st) => r.fulfill({ status: st || 200, contentType: "application/json", body: JSON.stringify(b) });
        if (u.pathname.startsWith("/auth/v1/user")) return j(user);
        if (u.pathname === "/rest/v1/admins") return j([{ user_id: uid }]);
        if (u.pathname === "/rest/v1/players") return j(pub.concat([{ ...pub[1], id: "99999999-0000-0000-0000-000000000000", name: "Zz Unpublished Test", published: false }]));
        if (u.pathname === "/rest/v1/player_of_week") {
          if (m === "GET") return row ? j(r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? row : [row]) : (r.request().headers()["accept"]?.includes("vnd.pgrst.object") ? r.fulfill({ status: 406, contentType: "application/json", body: '{"code":"PGRST116"}' }) : j([]));
          writes.push([m, r.request().postData() || u.search]);
          if (m === "POST") { row = JSON.parse(r.request().postData()); return j([row], 201); }
          if (m === "DELETE") { row = null; return r.fulfill({ status: 204, body: "" }); }
        }
        return j([]);
      });
      await page.route(u => /\/api\//.test(u.pathname), r => r.fulfill({ status: 200, contentType: "application/json", body: '{"accounts":[]}' }));
      await page.goto(BASE + "admin.html", { waitUntil: "networkidle" });
      await page.waitForSelector("#dash:not([hidden]) #potwAdmin", { timeout: 10000 });
      const opts = await page.$$eval("#potwPlayer option", o => o.map(x => x.textContent));
      ok(opts.length === pub.length + 1 && !opts.some(t => /Unpublished/.test(t)), `${tag}: admin lists only published players (${opts.length - 1})`);
      ok((await page.textContent("#potwNow")).includes("Not set"), `${tag}: admin shows "Not set" when nothing is picked`);
      await page.click("#potwSave"); ok(writes.length === 0, `${tag}: Save without a player writes nothing`);
      await page.selectOption("#potwPlayer", pick.id); await page.fill("#potwWeek", "2026-11-16"); await page.fill("#potwNote", TEST.note);
      ok((await page.textContent("#potwCount")) === String(TEST.note.length), `${tag}: note counter updates`);
      if (SHOTS) await page.locator("#potwAdmin").screenshot({ path: `${SHOTS}/${tag}-admin-potw-control-filled.png` });
      await page.click("#potwSave"); await page.waitForTimeout(400);
      const sent = writes.find(w => w[0] === "POST"); const body = sent && JSON.parse(sent[1]);
      ok(body && body.id === 1 && body.player_id === pick.id && body.note === TEST.note && body.week_of === "2026-11-16", `${tag}: Save upserts {id:1, player_id, note, week_of} (mocked)`);
      ok((await page.textContent("#potwNow")).startsWith("Live: " + pick.name), `${tag}: admin shows the live pick after saving`);
      if (SHOTS) await page.locator("#potwAdmin").screenshot({ path: `${SHOTS}/${tag}-admin-potw-control-saved.png` });
      await page.click("#potwClear"); await page.waitForTimeout(400);
      ok(writes.some(w => w[0] === "DELETE") && (await page.textContent("#potwNow")).includes("Not set") && (await page.inputValue("#potwPlayer")) === "", `${tag}: Clear deletes the row and resets the form (mocked)`);
      if (SHOTS) await page.locator("#potwAdmin").screenshot({ path: `${SHOTS}/${tag}-admin-potw-control-cleared.png` });
      const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= vw, `${tag}: admin no horizontal overflow (${w}px)`);
      ok(errs.length === 0, `${tag}: no console errors in admin${errs.length ? " → " + errs.join(" | ") : ""}`);
      await ctx.close(); }
  }
  const after = await (await fetch(`${SB}/rest/v1/player_of_week?select=*`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })).json();
  ok(JSON.stringify(after) === JSON.stringify(live), `live player_of_week unchanged by the tests (${JSON.stringify(after)})`);
  await browser.close();
  console.log(`\nPOTW tests: ${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failures:\n- " + failures.join("\n- ")); process.exit(1); }
})();
