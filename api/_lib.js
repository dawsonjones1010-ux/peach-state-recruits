// Shared server helpers. Runs on Vercel; uses only built-in fetch (no packages to install).
const SB = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "media";

function requireEnv() {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(k => !process.env[k]);
  if (missing.length) throw new Error("Missing settings in Vercel: " + missing.join(", "));
}

async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database ${method} ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Copy a file from a URL (e.g. Instagram's temporary CDN link) into permanent storage.
async function copyToStorage(sourceUrl, path, fallbackType = "application/octet-stream") {
  const src = await fetch(sourceUrl);
  if (!src.ok) throw new Error(`Could not download media (${src.status})`);
  const type = src.headers.get("content-type") || fallbackType;
  const buf = await src.arrayBuffer();
  const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": type, "x-upsert": "true" },
    body: buf
  });
  if (!up.ok) throw new Error(`Upload failed (${up.status}): ${(await up.text()).slice(0, 200)}`);
  return `${SB}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Who is calling? Returns the Supabase user for the bearer token, or null.
async function getUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const res = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function isAdmin(user) {
  if (!user) return false;
  const rows = await db(`admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`);
  return rows.length > 0;
}

// Scheduled runs send the CRON_SECRET; people send their login.
async function authorize(req, { allowCron = false } = {}) {
  const auth = req.headers.authorization || "";
  if (allowCron && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return { cron: true };
  const user = await getUser(req);
  if (await isAdmin(user)) return { user };
  return null;
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "player";
}

module.exports = { SB, KEY, requireEnv, db, copyToStorage, getUser, isAdmin, authorize, send, readJson, slugify };
