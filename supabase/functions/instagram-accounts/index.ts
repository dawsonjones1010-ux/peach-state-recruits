// Peach State Recruits: owner-only Instagram account status (GET) and connect-with-token (POST).
// Tokens never leave the server; the dashboard only sees "connected" and dates.
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await isAdmin(req))) return json(401, { error: "Owner only. Sign in again." });
    if (req.method === "GET") {
      const rows = await db("ig_accounts?select=handle,sport,access_token,expires_at,last_synced,last_result&order=handle");
      // deno-lint-ignore no-explicit-any
      return json(200, rows.map(({ access_token, ...r }: any) => ({ ...r, connected: !!access_token })));
    }
    if (req.method === "POST") {
      const { handle, token } = await req.json().catch(() => ({}));
      if (!handle || !token) return json(400, { error: "Choose an account and paste a token." });
      const t = String(token).trim();
      const me = await (await fetch(`https://graph.instagram.com/me?fields=username,account_type&access_token=${encodeURIComponent(t)}`)).json();
      if (me.error) return json(400, { error: `Instagram rejected that token: ${me.error.message}` });
      if (String(me.username || "").toLowerCase() !== String(handle).toLowerCase())
        return json(400, { error: `That token belongs to @${me.username}, not @${handle}.` });
      let access_token = t, expires_in = 60 * 24 * 3600;
      const secret = Deno.env.get("INSTAGRAM_APP_SECRET");
      if (secret) {
        const r = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(t)}`);
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.access_token) { access_token = j.access_token; expires_in = j.expires_in || expires_in; }
      }
      await db(`ig_accounts?handle=eq.${encodeURIComponent(handle)}`, {
        method: "PATCH", prefer: "return=minimal",
        body: { access_token, expires_at: new Date(Date.now() + expires_in * 1000).toISOString() },
      });
      return json(200, { ok: true, username: me.username, accountType: me.account_type });
    }
    return json(405, { error: "Method not allowed" });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
