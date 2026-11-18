// Peach State Recruits: one-time owner account setup.
// The owner enters their email, a password they choose, and the one-time setup code. If the email is the
// owner email, the code matches and no owner account exists yet, the account is created already confirmed
// (no email needed) and made the dashboard admin. The code stops working after it's used.
const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rpc = async (fn: string, body: unknown) => {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`Setup check failed (${r.status})`);
  return t ? JSON.parse(t) : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });
    const { email, password, code } = await req.json().catch(() => ({}));
    const e = String(email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return json(400, { error: "Enter your email." });
    if (String(password || "").length < 8) return json(400, { error: "Choose a password of at least 8 characters." });
    if (!code) return json(400, { error: "Enter the setup code you were given." });
    if ((await rpc("check_owner_setup", { p_email: e, p_code: String(code) })) !== true)
      return json(403, { error: "That email and setup code don't match, or the owner account was already created. If you already set it up, just sign in." });

    const existing = await rpc("user_id_for_email", { p_email: e });
    const r = existing
      ? await fetch(`${SB}/auth/v1/admin/users/${existing}`, { method: "PUT", headers: H, body: JSON.stringify({ password, email_confirm: true }) })
      : await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email: e, password, email_confirm: true }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return json(400, { error: j.msg || j.message || j.error_description || "Couldn't create the account." });
    }
    const uid = await rpc("finish_owner_setup", { p_email: e });
    if (!uid) return json(500, { error: "Account created but couldn't be made the owner. Try signing in." });
    return json(200, { ok: true, email: e });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});
