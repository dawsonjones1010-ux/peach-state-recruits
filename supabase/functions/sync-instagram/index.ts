// Peach State Recruits: Instagram -> website sync.
// Runs every 3 hours (pg_cron) and when the owner taps "Sync now" on the dashboard.
// New feature posts become player profiles; Instagram tokens are renewed before they expire.
// Auth is done in code: a scheduled call must carry the cron secret, a person must be an admin.

const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";
const MAX_NEW_PER_RUN = 8;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function db(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method: init.method || "GET",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database ${init.method || "GET"} ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function copyToStorage(src: string, path: string, fallback: string) {
  const r = await fetch(src);
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  const type = r.headers.get("content-type") || fallback;
  const up = await fetch(`${SB}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": type, "x-upsert": "true" },
    body: await r.arrayBuffer(),
  });
  if (!up.ok) throw new Error(`upload failed (${up.status})`);
  return `${SB}/storage/v1/object/public/media/${path}`;
}

// ---- Caption reader: "Name | POS | 2029 | 6'4 | 220 | School" then the write-up ----
const YEAR = /^(19|20)\d{2}$/;
const HEIGHT = /^\d\s*['’′]\s*\d{1,2}\s*(["”″]|'')?$/;
const WEIGHT = /^\d{2,3}\s*(lb|lbs)?$/i;
const clean = (s: string) => String(s || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

function parseCaption(caption?: string) {
  if (!caption) return null;
  const lines = caption.replace(/\r/g, "").split("\n");
  const first = lines.findIndex((l) => l.includes("|"));
  if (first === -1) return null;
  const parts = lines[first].split("|").map(clean).filter(Boolean);
  const yi = parts.findIndex((p) => YEAR.test(p));
  if (yi < 1) return null;
  let height: string | null = null, weight: string | null = null;
  const rest: string[] = [];
  for (const p of parts.slice(yi + 1)) {
    if (!height && HEIGHT.test(p)) {
      height = p.replace(/\s/g, "").replace(/[’′]/g, "'").replace(/(["”″]|'')$/, '"');
      if (!height.endsWith('"')) height += '"';
    } else if (!weight && WEIGHT.test(p)) weight = p.replace(/\s*(lb|lbs)$/i, "") + " lb";
    else rest.push(p);
  }
  const org = rest.join(" | ") || null;
  const isClub = !!org && /(mls|ecnl|\bfc\b|\bsc\b|club|travel|\b1\d\s?u\b|select|united|showcase|aau|7v7|national|elite)/i.test(org);
  const body = lines.slice(first + 1).map((l) => l.trim());
  while (body.length && (!body[body.length - 1] || /^([#@][^\s]+\s*)+$/.test(body[body.length - 1]))) body.pop();
  return {
    name: parts[0], position: parts.slice(1, yi).join(" / ") || null, gradYear: parseInt(parts[yi], 10),
    height, weight, school: org && !isClub ? org : null, team: isClub ? org : null,
    report: body.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null,
  };
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "player";

async function uniqueSlug(base: string) {
  const rows = await db(`players?select=slug&slug=like.${encodeURIComponent(base)}*`);
  const taken = new Set(rows.map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

// deno-lint-ignore no-explicit-any
function pickMedia(m: any) {
  const kids = (m.children && m.children.data) || [];
  let cover = null, video = null, poster = null;
  if (m.media_type === "IMAGE") cover = m.media_url;
  if (m.media_type === "VIDEO") { video = m.media_url; cover = m.thumbnail_url; poster = m.thumbnail_url; }
  if (m.media_type === "CAROUSEL_ALBUM") {
    // deno-lint-ignore no-explicit-any
    const img = kids.find((k: any) => k.media_type === "IMAGE"), vid = kids.find((k: any) => k.media_type === "VIDEO");
    cover = img ? img.media_url : kids[0] && (kids[0].thumbnail_url || kids[0].media_url);
    if (vid) { video = vid.media_url; poster = vid.thumbnail_url || null; }
  }
  return { cover, video, poster };
}

// deno-lint-ignore no-explicit-any
async function syncAccount(acct: any, pages: number) {
  const out = { handle: acct.handle, checked: 0, created: [] as string[], skipped: 0, errors: [] as string[] };
  let url: string | null = `https://graph.instagram.com/me/media?fields=${encodeURIComponent(FIELDS)}&limit=25&access_token=${encodeURIComponent(acct.access_token)}`;
  // deno-lint-ignore no-explicit-any
  const media: any[] = [];
  for (let p = 0; p < pages && url; p++) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`Instagram said: ${(j.error && j.error.message) || r.status}`);
    media.push(...(j.data || []));
    url = j.paging && j.paging.next;
  }
  out.checked = media.length;
  if (!media.length) return out;
  const existing = await db(`players?select=ig_media_id&ig_media_id=in.(${media.map((m) => encodeURIComponent(m.id)).join(",")})`);
  const known = new Set(existing.map((r: { ig_media_id: string }) => r.ig_media_id));
  for (const m of media.filter((m) => !known.has(m.id)).reverse()) {
    if (out.created.length >= MAX_NEW_PER_RUN) break;
    const info = parseCaption(m.caption);
    if (!info) { out.skipped++; continue; }
    try {
      const slug = await uniqueSlug(slugify(info.name));
      const { cover, video, poster } = pickMedia(m);
      const folder = `players/ig-${m.id}`;
      const cover_url = cover ? await copyToStorage(cover, `${folder}/cover.jpg`, "image/jpeg") : null;
      let video_url = null, video_poster = null;
      if (video) {
        try { video_url = await copyToStorage(video, `${folder}/highlights.mp4`, "video/mp4"); } catch (e) { out.errors.push(`${info.name}: video not copied (${(e as Error).message})`); }
        if (poster) { try { video_poster = await copyToStorage(poster, `${folder}/poster.jpg`, "image/jpeg"); } catch (_) { /* optional */ } }
      }
      const measurables = [info.height && { label: "Height", value: info.height }, info.weight && { label: "Weight", value: info.weight }].filter(Boolean);
      await db("players", { method: "POST", prefer: "return=minimal", body: {
        slug, name: info.name, sport: acct.sport, position: info.position, grad_year: info.gradYear,
        school: info.school, team: info.team, height: info.height, weight: info.weight, measurables,
        report: info.report, cover_url, video_url, video_poster, post_url: m.permalink, ig_media_id: m.id,
        ig_account: acct.handle, contact_name: "Peach State Recruits", posted_at: m.timestamp, published: true, show_on_home: true,
      } });
      out.created.push(info.name);
    } catch (e) { out.errors.push(`${info.name}: ${(e as Error).message}`); }
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function refreshToken(acct: any) {
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(acct.access_token)}`);
  const j = await r.json();
  if (r.ok && j.access_token) {
    await db(`ig_accounts?handle=eq.${encodeURIComponent(acct.handle)}`, { method: "PATCH", prefer: "return=minimal",
      body: { access_token: j.access_token, expires_at: new Date(Date.now() + (j.expires_in || 5184000) * 1000).toISOString() } });
  }
}

async function authorized(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (secret) {
    const ok = await db("rpc/verify_cron_secret", { method: "POST", body: { s: secret } });
    if (ok === true) return true;
  }
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: auth } });
  if (!u.ok) return false;
  const user = await u.json();
  if (!user || !user.id) return false;
  const rows = await db(`admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`);
  return rows.length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await authorized(req))) return json(401, { error: "Owner only" });
    let opts: { full?: boolean } = {};
    try { opts = await req.json(); } catch (_) { /* no body */ }
    const accounts = await db("ig_accounts?select=*&access_token=not.is.null");
    if (!accounts.length) return json(200, { message: "No Instagram accounts connected yet.", results: [] });
    const results = [];
    for (const acct of accounts) {
      if (!acct.expires_at || new Date(acct.expires_at).getTime() - Date.now() < 15 * 864e5) {
        try { await refreshToken(acct); } catch (_) { /* keep going */ }
      }
      // deno-lint-ignore no-explicit-any
      let s: any;
      try { s = await syncAccount(acct, opts.full ? 4 : 1); } catch (e) { s = { handle: acct.handle, error: (e as Error).message }; }
      results.push(s);
      const note = s.error ? `Error: ${s.error}` : `Added ${s.created.length}${s.created.length ? ": " + s.created.join(", ") : ""}`;
      await db(`ig_accounts?handle=eq.${encodeURIComponent(acct.handle)}`, { method: "PATCH", prefer: "return=minimal",
        body: { last_synced: new Date().toISOString(), last_result: note.slice(0, 500) } });
    }
    return json(200, { results });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
