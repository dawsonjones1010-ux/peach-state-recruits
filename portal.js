/* Shared code for the admin page and the player login page. Uses Supabase from the CDN. */
(function () {
  const C = window.PSR_CONFIG || {};
  const esc = window.PSR.esc;
  const ready = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
  const sb = ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;

  // "Label: value" lines <-> [{label, value}]
  const pairsToText = (arr) => (arr || []).map(x => `${x.label}: ${x.value}`).join("\n");
  const textToPairs = (t) => String(t || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf(":"); return i === -1 ? { label: l, value: "" } : { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
  });
  // "Label | https://..." lines <-> [{label, url}]
  const linksToText = (arr) => (arr || []).map(x => `${x.label} | ${x.url}`).join("\n");
  const textToLinks = (t) => String(t || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const [label, url] = l.split("|").map(s => s.trim());
    return url ? { label, url } : { label: label, url: label };
  }).filter(x => /^https?:\/\//.test(x.url));
  // Stats: title + "Col, Col" + "val, val"
  const statsToFields = (s) => ({
    title: (s && s.title) || "", cols: s && s.columns ? s.columns.join(", ") : "",
    row: s && s.rows && s.rows[0] ? s.rows[0].join(", ") : ""
  });
  const fieldsToStats = (title, cols, row) => {
    const c = String(cols || "").split(",").map(s => s.trim()).filter(Boolean);
    const r = String(row || "").split(",").map(s => s.trim());
    return c.length ? { title: title || "Stats", columns: c, rows: [c.map((_, i) => r[i] || "")] } : null;
  };

  async function upload(playerId, file, name) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `players/${playerId}/${name}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  }

  function msg(el, text, kind) {
    el.textContent = text; el.className = "form-msg " + (kind || ""); el.hidden = !text;
  }

  function profileLink(slug) {
    return window.PSR.shareProfileUrl ? window.PSR.shareProfileUrl(slug) : `${location.origin}/player/${encodeURIComponent(slug)}`;
  }

  window.PORTAL = { sb, ready, esc, pairsToText, textToPairs, linksToText, textToLinks, statsToFields, fieldsToStats, upload, msg, profileLink };
})();
