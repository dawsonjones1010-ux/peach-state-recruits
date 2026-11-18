// Peach State Recruits: owner-only "Give login".
// Creates (or finds) the player's account, links it to their profile, and returns a one-time sign-in link
// that opens account.html directly (no redirect-URL setting needed).
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_SITE = "https://dawsonjones1010-ux.github.io/peach-state-recruits";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function db(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method: init.method || "GET",
    headers: { ...admin, ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database error (${res.status}): ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function isAdmin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: auth } });
  if (!u.ok) return false;
  const user = await u.json();
  if (!user?.id) return false;
  const rows = await db(`admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}`);
  return rows.length > 0;
}

async function generateLink(type: string, email: string, redirectTo: string) {
  const r = await fetch(`${SB}/auth/v1/admin/generate_link`, {
    method: "POST", headers: admin, body: JSON.stringify({ type, email, redirect_to: redirectTo }),
  });
  return { ok: r.ok, j: await r.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    if (!(await isAdmin(req))) return json(401, { error: "Owner only. Sign in again." });
    const { playerId, email, site } = await req.json().catch(() => ({}));
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!playerId || !/^\S+@\S+\.\S+$/.test(cleanEmail)) return json(400, { error: "Enter a valid email." });
    const base = (/^https:\/\/[^\s"'<>]+$/.test(String(site || "")) ? String(site) : DEFAULT_SITE).replace(/\/+$/, "");
    const redirectTo = `${base}/account.html`;

    // New person: "invite" creates the account. Existing person: "magiclink" signs them in.
    let { ok, j } = await generateLink("invite", cleanEmail, redirectTo);
    let type = "invite";
    if (!ok) { ({ ok, j } = await generateLink("magiclink", cleanEmail, redirectTo)); type = "magiclink"; }
    if (!ok) return json(400, { error: j?.msg || j?.error_description || j?.message || "Could not create the login." });

    const user = j.user || j;
    const hashed = j.hashed_token || j.properties?.hashed_token;
    if (!user?.id || !hashed) return json(500, { error: "Login created but no sign-in link came back." });
    const vtype = j.verification_type || j.properties?.verification_type || type;

    await db(`players?id=eq.${encodeURIComponent(playerId)}`, {
      method: "PATCH", prefer: "return=minimal", body: { owner_id: user.id, owner_email: cleanEmail },
    });
    const link = `${redirectTo}?th=${encodeURIComponent(hashed)}&t=${encodeURIComponent(vtype)}`;
    return json(200, { ok: true, email: cleanEmail, link, newAccount: type === "invite" });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
