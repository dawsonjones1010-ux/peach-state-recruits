// Instagram tokens expire after 60 days. This renews them every week so syncing never stops.
const { db, authorize, send, requireEnv } = require("./_lib");

module.exports = async (req, res) => {
  try {
    requireEnv();
    if (!(await authorize(req, { allowCron: true }))) return send(res, 401, { error: "Admins only" });
    const accounts = await db("ig_accounts?select=handle,access_token&access_token=not.is.null");
    const results = [];
    for (const a of accounts) {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.access_token)}`);
      const j = await r.json();
      if (r.ok && j.access_token) {
        await db(`ig_accounts?handle=eq.${encodeURIComponent(a.handle)}`, {
          method: "PATCH", prefer: "return=minimal",
          body: { access_token: j.access_token, expires_at: new Date(Date.now() + (j.expires_in || 5184000) * 1000).toISOString() }
        });
        results.push({ handle: a.handle, renewed: true });
      } else {
        results.push({ handle: a.handle, renewed: false, error: (j.error && j.error.message) || r.status });
      }
    }
    send(res, 200, { results });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
