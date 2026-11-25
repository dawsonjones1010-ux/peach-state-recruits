// Peach State Recruits accounts: create an account with email + password (+ optional username),
// and sign in with a username. Email sign-in goes straight to Supabase Auth from the browser.
// Accounts are created already confirmed because the project has no email sender yet.
// Usernames never leave the server as emails, so nobody can look up someone's email.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USER_RE = /^[a-z0-9_.]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "peachstate", "peachstaterecruits", "psr", "support", "help", "coach", "owner", "root", "null", "undefined"]);

async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const data = new TextEncoder().encode(ip + "|" + SERVICE.slice(-16));
  const d = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
async function tooMany(ip: string, kind: string, minutes: number, max: number) {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const { count } = await admin.from("auth_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ip).eq("kind", kind).gte("created_at", since);
  return (count || 0) >= max;
}
const note = (ip: string, kind: string) => admin.from("auth_attempts").insert({ ip_hash: ip, kind });

async function passwordSession(email: string, password: string) {
  const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Bad request"); }
  const ip = await ipHash(req);
  // Keep the attempts table small.
  admin.from("auth_attempts").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString()).then(() => {});

  if (body.action === "signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const username = String(body.username || "").trim().toLowerCase();
    if (body.consent !== true) return fail("Please check the box to agree to the terms.");
    if (!EMAIL_RE.test(email) || email.length > 254) return fail("Enter a valid email address.");
    if (password.length < 8 || password.length > 72) return fail("Use a password with at least 8 characters.");
    if (username) {
      if (!USER_RE.test(username) || /^[._]|[._]$/.test(username)) return fail("Usernames are 3 to 20 letters, numbers, dots or underscores, and can't start or end with a dot or underscore.");
      if (RESERVED.has(username)) return fail("That username isn't available. Try another.");
      const { data: taken } = await admin.from("usernames").select("user_id").eq("username", username).maybeSingle();
      if (taken) return fail("That username is taken. Try another.");
    }
    if (await tooMany(ip, "signup", 60, 5)) return fail("Too many new accounts from this connection. Try again in an hour.", 429);
    await note(ip, "signup");
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: username ? { username } : {} });
    if (error || !created.user) {
      const m = String(error?.message || "");
      if (/already|registered|exists/i.test(m)) return fail("An account with that email already exists. Sign in instead.", 409);
      if (/password/i.test(m)) return fail("That password is too weak. Try a longer one.");
      return fail("Couldn't create the account. Try again.", 500);
    }
    if (username) {
      const { error: uerr } = await admin.from("usernames").insert({ user_id: created.user.id, username });
      if (uerr) { await admin.auth.admin.deleteUser(created.user.id); return fail("That username was just taken. Try another.", 409); }
    }
    const session = await passwordSession(email, password);
    if (!session) return fail("Your account was created. Sign in with your email and password.", 202);
    return json({ session, username: username || null });
  }

  if (body.action === "login") {
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) return fail("Enter your username and password.");
    if (await tooMany(ip, "login_fail", 15, 10)) return fail("Too many wrong tries. Wait 15 minutes and try again.", 429);
    const wrong = async () => { await note(ip, "login_fail"); return fail("Wrong username or password.", 401); };
    if (!USER_RE.test(username)) return await wrong();
    const { data: row } = await admin.from("usernames").select("user_id").eq("username", username).maybeSingle();
    if (!row) return await wrong();
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const email = u?.user?.email;
    if (!email) return await wrong();
    const session = await passwordSession(email, password);
    if (!session) return await wrong();
    await note(ip, "login");
    return json({ session });
  }

  if (body.action === "set_username") {
    // Signed-in users add or change their username.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = await admin.auth.getUser(token);
    if (!who?.user) return fail("Sign in first.", 401);
    const username = String(body.username || "").trim().toLowerCase();
    if (!USER_RE.test(username) || /^[._]|[._]$/.test(username)) return fail("Usernames are 3 to 20 letters, numbers, dots or underscores, and can't start or end with a dot or underscore.");
    if (RESERVED.has(username)) return fail("That username isn't available. Try another.");
    const { data: taken } = await admin.from("usernames").select("user_id").eq("username", username).maybeSingle();
    if (taken && taken.user_id !== who.user.id) return fail("That username is taken. Try another.", 409);
    const { error } = await admin.from("usernames").upsert({ user_id: who.user.id, username });
    if (error) return fail("Couldn't save that username. Try another.", 409);
    return json({ username });
  }

  return fail("Unknown action");
});
