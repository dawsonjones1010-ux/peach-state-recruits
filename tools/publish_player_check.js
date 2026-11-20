#!/usr/bin/env node
// Targeted check for a just-built player profile. Used by bin/add-player.sh.
// Usage: node tools/publish_player_check.js <baseUrl> <slug> [<slug>...]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE
  || "/tmp/pw/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const baseArg = process.argv[2];
const slugs = process.argv.slice(3);
if (!baseArg || !slugs.length) {
  fail("usage: node tools/publish_player_check.js <baseUrl> <slug> [<slug>...]");
}
const BASE = baseArg.replace(/\/?$/, "/");
const SITE = "https://dawsonjones1010-ux.github.io/peach-state-recruits/";

async function statusOf(request, url) {
  const res = await request.get(url, { timeout: 60000 });
  return { url, status: res.status(), ok: res.ok(), type: res.headers()["content-type"] || "" };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const slug of slugs) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      // The live site (and players.json) uses absolute GitHub Pages URLs for covers
      // and clips. Point those at the local server so this check works before deploy.
      await page.route(/https:\/\/dawsonjones1010-ux\.github\.io\/peach-state-recruits\//, async (route) => {
        const u = route.request().url().replace(SITE, BASE);
        const res = await route.fetch({ url: u });
        const body = await res.body();
        const headers = res.headers();
        await route.fulfill({ status: res.status(), headers, body });
      });
      // Use the local players.json, not live Supabase, so a dry-run / pre-upsert
      // publish is actually what we check.
      await page.route(/\/rest\/v1\/players/, (route) => route.abort());

      const profile = `${BASE}player/${slug}/`;
      await page.goto(profile, { waitUntil: "networkidle", timeout: 60000 });
      const title = await page.title();
      const first = slug.split("-")[0];
      if (!title.toLowerCase().includes(first.toLowerCase())) {
        fail(`${slug}: title did not include the player name: ${title}`);
      }
      const nameEl = page.locator("#pName");
      await nameEl.waitFor({ timeout: 15000 });
      const shown = (await nameEl.textContent() || "").trim();
      if (!shown) fail(`${slug}: #pName was empty`);

      const cover = `${BASE}images/players/${slug}.jpg`;
      const cover640 = `${BASE}images/players/${slug}-640.jpg`;
      const og = `${BASE}images/og/${slug}.jpg`;
      for (const url of [cover, cover640, og]) {
        const r = await statusOf(page.request, url);
        if (r.status !== 200) fail(`${slug}: ${url} -> HTTP ${r.status}`);
      }

      const videoCount = await page.locator("video").count();
      const listed = await page.$$eval("video", (els) =>
        els.map((v) => v.currentSrc || v.src || "").filter(Boolean)
      );
      for (let i = 1; i <= videoCount; i++) {
        const clip = `${BASE}videos/${slug}/clip${i}.mp4`;
        const r = await statusOf(page.request, clip);
        if (r.status !== 200) fail(`${slug}: ${clip} -> HTTP ${r.status}`);
        if (!/mp4|octet-stream/i.test(r.type) && r.type) {
          console.warn(`warn ${slug}: ${clip} content-type ${r.type}`);
        }
      }
      if (listed.length !== videoCount) {
        fail(`${slug}: video src count ${listed.length} != <video> count ${videoCount}`);
      }

      await page.goto(`${BASE}players.html`, { waitUntil: "networkidle", timeout: 60000 });
      const onList = await page.evaluate((name) => document.body.innerText.includes(name) || document.body.innerHTML.includes(name), shown);
      const hrefs = await page.$$eval("a", (els, slug) =>
        els.map((a) => a.getAttribute("href") || "").filter((h) => h.includes(slug)), slug);
      if (!onList && !hrefs.length) fail(`${slug}: not found on players.html`);
      if (pageErrors.length) fail(`${slug}: console errors: ${pageErrors.join("; ")}`);
      console.log(`ok ${slug}: ${shown} | cover 200 | ${videoCount} clip(s) 200 | on All Players`);
      errors.push(...pageErrors);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (errors.length) fail(errors.join("; "));
  console.log(`targeted check passed for ${slugs.length} player(s)`);
})().catch((e) => { console.error(e); process.exit(1); });
