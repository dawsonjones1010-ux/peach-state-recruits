// Checks the connected Instagram accounts for new feature posts and creates a profile for each one.
// Runs automatically every day (see vercel.json) and whenever you press "Sync now" on the admin page.
const { db, copyToStorage, authorize, send, requireEnv, slugify } = require("./_lib");
const { parseCaption } = require("./_caption");

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";
const MAX_NEW_PER_RUN = 6;   // keeps each run inside the time limit; the next run picks up the rest

function pickMedia(m) {
  const kids = (m.children && m.children.data) || [];
  let cover = null, video = null, poster = null;
  if (m.media_type === "IMAGE") cover = m.media_url;
  if (m.media_type === "VIDEO") { video = m.media_url; cover = m.thumbnail_url; poster = m.thumbnail_url; }
  if (m.media_type === "CAROUSEL_ALBUM") {
    const firstImg = kids.find(k => k.media_type === "IMAGE");
    const firstVid = kids.find(k => k.media_type === "VIDEO");
    cover = firstImg ? firstImg.media_url : (kids[0] && (kids[0].thumbnail_url || kids[0].media_url));
    if (firstVid) { video = firstVid.media_url; poster = firstVid.thumbnail_url || null; }
  }
  return { cover, video, poster };
}

async function uniqueSlug(base) {
  const rows = await db(`players?select=slug&slug=like.${encodeURIComponent(base)}*`);
  const taken = new Set(rows.map(r => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

async function syncAccount(acct, { pages = 1 } = {}) {
  const summary = { handle: acct.handle, checked: 0, created: [], skipped: 0, errors: [] };
  let url = `https://graph.instagram.com/me/media?fields=${encodeURIComponent(FIELDS)}&limit=25&access_token=${encodeURIComponent(acct.access_token)}`;
  const media = [];
  for (let p = 0; p < pages && url; p++) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`Instagram said: ${(j.error && j.error.message) || r.status}`);
    media.push(...(j.data || []));
    url = j.paging && j.paging.next;
  }
  summary.checked = media.length;
  if (!media.length) return summary;

  const ids = media.map(m => m.id);
  const existing = await db(`players?select=ig_media_id&ig_media_id=in.(${ids.map(encodeURIComponent).join(",")})`);
  const known = new Set(existing.map(r => r.ig_media_id));

  // Oldest first, so profiles are created in posting order
  const fresh = media.filter(m => !known.has(m.id)).reverse();
  for (const m of fresh) {
    if (summary.created.length >= MAX_NEW_PER_RUN) break;
    const info = parseCaption(m.caption);
    if (!info) { summary.skipped++; continue; }
    try {
      const slug = await uniqueSlug(slugify(info.name));
      const { cover, video, poster } = pickMedia(m);
      const folder = `players/ig-${m.id}`;
      const cover_url = cover ? await copyToStorage(cover, `${folder}/cover.jpg`, "image/jpeg") : null;
      let video_url = null, video_poster = null;
      if (video) {
        try { video_url = await copyToStorage(video, `${folder}/highlights.mp4`, "video/mp4"); } catch (e) { summary.errors.push(`${info.name}: video not copied (${e.message})`); }
        if (poster) { try { video_poster = await copyToStorage(poster, `${folder}/poster.jpg`, "image/jpeg"); } catch (e) {} }
      }
      const measurables = [];
      if (info.height) measurables.push({ label: "Height", value: info.height });
      if (info.weight) measurables.push({ label: "Weight", value: info.weight });

      await db("players", {
        method: "POST", prefer: "return=minimal",
        body: {
          slug, name: info.name, sport: acct.sport, position: info.position, grad_year: info.gradYear,
          school: info.school, team: info.team, height: info.height, weight: info.weight,
          measurables, report: info.report, cover_url, video_url, video_poster,
          post_url: m.permalink, ig_media_id: m.id, ig_account: acct.handle,
          contact_name: "Peach State Recruits", posted_at: m.timestamp,
          published: true, show_on_home: true
        }
      });
      summary.created.push(info.name);
    } catch (e) {
      summary.errors.push(`${info.name}: ${e.message}`);
    }
  }
  return summary;
}

module.exports = async (req, res) => {
  try {
    requireEnv();
    if (!(await authorize(req, { allowCron: true }))) return send(res, 401, { error: "Admins only" });
    const full = String((req.query && req.query.full) || "") === "1";
    const accounts = await db("ig_accounts?select=*&access_token=not.is.null");
    if (!accounts.length) return send(res, 200, { message: "No Instagram accounts connected yet.", results: [] });

    const results = [];
    for (const acct of accounts) {
      let s;
      try { s = await syncAccount(acct, { pages: full ? 4 : 1 }); }
      catch (e) { s = { handle: acct.handle, error: e.message }; }
      results.push(s);
      const note = s.error ? `Error: ${s.error}` : `Added ${s.created.length}${s.created.length ? ": " + s.created.join(", ") : ""}`;
      await db(`ig_accounts?handle=eq.${encodeURIComponent(acct.handle)}`, {
        method: "PATCH", prefer: "return=minimal",
        body: { last_synced: new Date().toISOString(), last_result: note.slice(0, 500) }
      });
    }
    send(res, 200, { results });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
