// Admin-only: see which Instagram accounts are connected (GET), or connect one with a token (POST).
const { db, authorize, send, readJson, requireEnv } = require("./_lib");

async function toLongLived(token) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) return null;
  const r = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(token)}`);
  const j = await r.json();
  return r.ok && j.access_token ? j : null;
}

module.exports = async (req, res) => {
  try {
    requireEnv();
    if (!(await authorize(req))) return send(res, 401, { error: "Admins only" });

    if (req.method === "GET") {
      const rows = await db("ig_accounts?select=handle,sport,access_token,expires_at,last_synced,last_result&order=handle");
      return send(res, 200, rows.map(({ access_token, ...r }) => ({ ...r, connected: !!access_token })));
    }

    if (req.method === "POST") {
      const { handle, token } = await readJson(req);
      if (!handle || !token) return send(res, 400, { error: "Choose an account and paste a token." });
      const me = await (await fetch(`https://graph.instagram.com/me?fields=username,account_type&access_token=${encodeURIComponent(token.trim())}`)).json();
      if (me.error) return send(res, 400, { error: `Instagram rejected that token: ${me.error.message}` });
      if (me.username.toLowerCase() !== handle.toLowerCase())
        return send(res, 400, { error: `That token belongs to @${me.username}, not @${handle}.` });

      let access_token = token.trim();
      let expires_in = 60 * 24 * 3600;
      const long = await toLongLived(access_token);
      if (long) { access_token = long.access_token; expires_in = long.expires_in || expires_in; }

      await db(`ig_accounts?handle=eq.${encodeURIComponent(handle)}`, {
        method: "PATCH", prefer: "return=minimal",
        body: { access_token, expires_at: new Date(Date.now() + expires_in * 1000).toISOString() }
      });
      return send(res, 200, { ok: true, username: me.username, accountType: me.account_type });
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
