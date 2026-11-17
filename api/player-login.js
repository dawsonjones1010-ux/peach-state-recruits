// Admin-only: give a player their own login. Creates (or finds) their account, links it to their profile,
// and returns a one-time sign-in link you can DM or text them.
const { SB, KEY, db, authorize, send, readJson, requireEnv } = require("./_lib");

async function generateLink(type, email, redirectTo) {
  const r = await fetch(`${SB}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type, email, redirect_to: redirectTo })
  });
  const j = await r.json();
  return { ok: r.ok, j };
}

module.exports = async (req, res) => {
  try {
    requireEnv();
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!(await authorize(req))) return send(res, 401, { error: "Admins only" });

    const { playerId, email } = await readJson(req);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!playerId || !/^\S+@\S+\.\S+$/.test(cleanEmail)) return send(res, 400, { error: "Enter a valid email." });

    const site = process.env.SITE_URL || `https://${req.headers.host}`;
    const redirectTo = `${site.replace(/\/$/, "")}/account.html`;

    // New person: "invite" creates their account. Existing person: "magiclink" just signs them in.
    let { ok, j } = await generateLink("invite", cleanEmail, redirectTo);
    if (!ok) ({ ok, j } = await generateLink("magiclink", cleanEmail, redirectTo));
    if (!ok) return send(res, 400, { error: (j && (j.msg || j.error_description || j.message)) || "Could not create the login." });

    const user = j.user || j;
    const link = j.action_link || (j.properties && j.properties.action_link);
    if (!user || !user.id) return send(res, 500, { error: "Login created but no user id came back." });

    await db(`players?id=eq.${encodeURIComponent(playerId)}`, {
      method: "PATCH", prefer: "return=minimal",
      body: { owner_id: user.id, owner_email: cleanEmail }
    });
    send(res, 200, { ok: true, email: cleanEmail, link });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
};
