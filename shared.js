/* Shared helpers for Peach State Recruits pages */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Your logo: set logoImage in config.js (e.g. "images/logo.png"). Until then, only the script wordmark shows.
  function logoMark(cfg) {
    return cfg && cfg.logoImage ? `<img class="logo-mark" src="${esc(cfg.logoImage)}" alt="">` : "";
  }
  const LOGO = "";

  // Generated cover graphic, used when a player has no cover image yet.
  function cover(p, opts = {}) {
    const name = String(p.name || "Athlete").toUpperCase();
    const parts = name.split(" ");
    const first = parts.shift() || "";
    const last = parts.join(" ") || "";
    const hue = p.coverColor || "#f5874a";
    const num = p.number ? String(p.number) : "";
    const id = "g" + Math.random().toString(36).slice(2, 8);
    const pos = (p.position || "").toUpperCase();
    const cls = p.gradYear ? "CLASS OF " + p.gradYear : "";
    const F = "'Barlow Condensed','Arial Narrow',sans-serif";
    return `<svg viewBox="0 0 400 500" role="img" aria-label="${esc(p.name)} feature cover" ${opts.cls ? `class="${opts.cls}"` : ""}>
      <defs>
        <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2c4a"/><stop offset="1" stop-color="#0e1b33"/></linearGradient>
        <pattern id="${id}p" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-25)"><rect width="1.5" height="14" fill="#fff" opacity=".05"/></pattern>
        <clipPath id="${id}c"><rect width="400" height="500"/></clipPath>
      </defs>
      <g clip-path="url(#${id}c)">
        <rect width="400" height="500" fill="url(#${id}a)"/>
        <rect width="400" height="500" fill="url(#${id}p)"/>
        <text x="408" y="300" text-anchor="end" font-family="${F}" font-weight="800" font-size="330" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2">${esc(num)}</text>
        <path d="M0 330 L400 255 L400 300 L0 375 Z" fill="${hue}"/>
        <path d="M0 384 L400 309 L400 316 L0 391 Z" fill="${hue}" opacity=".45"/>
        <rect x="28" y="30" width="44" height="4" fill="${hue}"/>
        <text x="28" y="58" font-family="${F}" font-weight="700" font-size="20" letter-spacing="1.5" fill="#fff">${esc(String(p.sport || "").toUpperCase())}</text>
        <text x="372" y="58" text-anchor="end" font-family="${F}" font-weight="600" font-size="15" letter-spacing="1" fill="#fff" opacity=".55">PEACH STATE RECRUITS</text>
        <text x="28" y="404" font-family="${F}" font-weight="700" font-size="19" letter-spacing=".5" fill="${hue}">${esc([pos, cls].filter(Boolean).join("  |  "))}</text>
        <text x="28" y="440" font-family="${F}" font-weight="600" font-size="34" fill="#fff" opacity=".85">${esc(first)}</text>
        <text x="25" y="486" font-family="${F}" font-weight="800" font-size="${Math.min(64, Math.floor(600 / Math.max(last.length, 1)))}" fill="#fff">${esc(last)}</text>
      </g>
    </svg>`;
  }

  function coverOrImage(p, cls, eager) {
    if (p.coverImage) return `<img src="${esc(p.coverImage)}" alt="${esc(p.name)} feature cover" ${cls ? `class="${cls}"` : ""} width="1080" height="1432" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    return cover(p, { cls });
  }

  function payLink(cfg, id) {
    const link = cfg.paymentLinks && cfg.paymentLinks[id];
    return link || `https://ig.me/m/${cfg.instagram}`;
  }

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---- Data: live database when configured, otherwise players.json ----
  const C = () => window.PSR_CONFIG || {};
  const hasDb = () => !!(C().supabaseUrl && C().supabaseAnonKey);

  function fromRow(r) {
    const measurables = (r.measurables && r.measurables.length) ? r.measurables
      : [r.height && { label: "Height", value: r.height }, r.weight && { label: "Weight", value: r.weight }].filter(Boolean);
    return {
      id: r.id, slug: r.slug, name: r.name, sport: r.sport, position: r.position, gradYear: r.grad_year,
      school: r.school, team: r.team, location: r.location, coverImage: r.cover_url,
      measurables, report: r.report, stats: r.stats, academics: r.academics || [], links: r.links || [],
      video: { file: r.video_url || "", poster: r.video_poster || "" },
      highlights: r.post_url ? [{ title: "Watch the feature on Instagram", url: r.post_url }] : [],
      postUrl: r.post_url, views: r.views, viewsAsOf: r.views_as_of,
      contactEmail: r.contact_email, contactName: r.contact_name || "Peach State Recruits",
      contactInstagram: r.contact_email ? "" : r.ig_account,
      showOnHome: r.show_on_home, active: r.published, account: r.ig_account,
      sample: !!r.sample, sampleNote: r.sample_note || "",
      headline: r.headline || "", playerInstagram: (r.player_instagram || []).filter(Boolean),
      videos: (r.player_videos || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    };
  }

  async function loadPlayers() {
    if (hasDb()) {
      try {
        const h = { headers: { apikey: C().supabaseAnonKey, Authorization: `Bearer ${C().supabaseAnonKey}` } };
        const u = `${C().supabaseUrl}/rest/v1/players?published=eq.true&order=posted_at.desc.nullslast&select=`;
        let r = await fetch(u + encodeURIComponent("*,player_videos(id,kind,url,title,created_at)"), h);
        if (!r.ok) r = await fetch(u + "*", h);
        if (r.ok) { const rows = await r.json(); if (rows.length) return rows.map(fromRow); }
      } catch (e) {}
    }
    try {
      const r = await fetch("players.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      return window.PSR_PLAYERS || [];
    }
  }

  // Counts a profile view for the owner dashboard (database mode only; no personal data stored).
  function countView(slug) {
    if (!hasDb() || !slug) return;
    try {
      const key = "psr_v_" + slug;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      const ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "").slice(0, 38) : "direct";
      fetch(`${C().supabaseUrl}/rest/v1/profile_views`, {
        method: "POST", keepalive: true,
        headers: { apikey: C().supabaseAnonKey, Authorization: `Bearer ${C().supabaseAnonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ slug, source: ref })
      }).catch(() => {});
    } catch (e) {}
  }

  // Homepage "Recent features": newest synced posts, or the hand-entered list in config.js
  function recentFromPlayers(players) {
    const live = players.filter(p => p.showOnHome && p.coverImage).slice(0, 6);
    if (!live.length) return C().recentFeatures || [];
    return live.map(p => ({
      name: p.name, sport: p.sport,
      detail: [p.position, p.gradYear ? "Class of " + p.gradYear : "", p.school || p.team].filter(Boolean).join(", "),
      views: p.views, viewsAsOf: p.viewsAsOf, image: p.coverImage, postUrl: p.postUrl,
      profile: p.slug, account: p.account
    }));
  }

  // Works for /player/slug (live site), player.html?p=slug and player.html#slug (preview)
  function profileUrl(slug) { return `player.html#${encodeURIComponent(slug)}`; }

  // The site's address: config.siteUrl if set, otherwise the current origin + folder
  // (e.g. https://user.github.io/peach-state-recruits). No trailing slash.
  function siteBase() {
    const set = String(C().siteUrl || "").trim();
    if (set) return set.replace(/\/+$/, "");
    const path = location.pathname.replace(/\/player\/[^/]*\/?$/, "/").replace(/[^/]*$/, "");
    return (location.origin + path).replace(/\/+$/, "");
  }
  // Shareable profile link (/player/slug works on Vercel, Apache and GitHub Pages via 404.html)
  function shareProfileUrl(slug) { return `${siteBase()}/player/${encodeURIComponent(slug)}`; }
  // The same address without https:// or www., for showing on the page
  function displayUrl(url) { return String(url).replace(/^https?:\/\//, "").replace(/^www\./, ""); }

  // ---- Player videos: turn a pasted link into {kind, url, embed} ----
  function parseVideo(raw) {
    let url = String(raw || "").trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    let u; try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    const host = u.hostname.replace(/^(www|m)\./, "");
    let m;
    if (host === "youtu.be" && (m = u.pathname.match(/^\/([\w-]{11})/))) return { kind: "youtube", url: u.href, id: m[1] };
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
      const id = u.searchParams.get("v") || ((m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)) && m[1]);
      if (id && /^[\w-]{11}$/.test(id)) return { kind: "youtube", url: u.href, id };
    }
    if (/(^|\.)vimeo\.com$/.test(host) && (m = u.pathname.match(/(?:^|\/)(\d{6,})(?:\/|$)/))) return { kind: "vimeo", url: u.href, id: m[1] };
    if (/(^|\.)hudl\.com$/.test(host)) return { kind: "hudl", url: u.href };
    if (/(^|\.)instagram\.com$/.test(host)) return { kind: "instagram", url: u.href };
    return { kind: "link", url: u.href };
  }
  const VIDEO_LABEL = { youtube: "YouTube", vimeo: "Vimeo", hudl: "Hudl", instagram: "Instagram", link: "Video link", file: "Uploaded clip" };
  // HTML for one video: embedded player for YouTube/Vimeo/uploads, a link card for everything else
  function videoHtml(v, name) {
    const p = v.kind === "file" ? { kind: "file", url: v.url } : (parseVideo(v.url) || { kind: "link", url: v.url });
    const t = esc(v.title || `${name || "Player"} highlights`);
    if (p.kind === "youtube") return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(p.id)}" title="${t}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    if (p.kind === "vimeo") return `<div class="video"><iframe src="https://player.vimeo.com/video/${esc(p.id)}" title="${t}" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    if (p.kind === "file") return `<div class="video"><video src="${esc(p.url)}" controls playsinline preload="metadata" aria-label="${t}"></video></div>`;
    return `<a class="vlink" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="vlink-ic">${ICON.play}</span><span><b>${esc(v.title || "Watch on " + VIDEO_LABEL[p.kind])}</b><small>${esc(VIDEO_LABEL[p.kind])} · ${esc(displayUrl(p.url)).slice(0, 48)}</small></span><span aria-hidden="true">↗</span></a>`;
  }

  // ---- v2 helpers: icons, nav, motion, sharing, QR ----
  const ICON = {
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    qr: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    ig: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    print: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };

  const reducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Mobile menu toggle (button#menuBtn + #mobileMenu), closes on link tap and Escape.
  function initNav() {
    document.documentElement.classList.add("js");
    const btn = document.getElementById("menuBtn"), menu = document.getElementById("mobileMenu");
    if (!btn || !menu) return;
    const set = (open) => { btn.setAttribute("aria-expanded", String(open)); menu.classList.toggle("open", open); };
    btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("open")) { set(false); btn.focus(); } });
    window.addEventListener("resize", () => { if (window.innerWidth > 960) set(false); });
  }

  // Fade-up on scroll for elements with .reveal (skipped for reduced motion).
  function reveal(root) {
    const els = [...(root || document).querySelectorAll(".reveal:not(.in)")];
    if (!("IntersectionObserver" in window) || reducedMotion()) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(e => io.observe(e));
  }

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || "Copied"); return true; }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); toast(ok ? (okMsg || "Copied") : text); return ok;
    }
  }

  // Native share sheet on phones, copy link everywhere else.
  async function shareLink(url, title, text) {
    if (navigator.share) {
      try { await navigator.share({ url, title, text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    copyText(url, "Profile link copied");
  }

  // QR code as inline SVG, drawn on the device (vendor/qrcode.min.js, loaded only when needed). No outside service.
  let qrLoading = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLoading) qrLoading = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "vendor/qrcode.min.js?v=4"; s.async = true;
      s.onload = () => res(window.qrcode); s.onerror = rej; document.head.appendChild(s);
    });
    return qrLoading;
  }
  async function qrSvg(text, label) {
    const qrcode = await loadQr();
    const q = qrcode(0, "M"); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2, size = n + m * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || "QR code")}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#0a1120"/></svg>`;
  }

  window.PSR = { esc, LOGO, logoMark, cover, coverOrImage, payLink, toast, loadPlayers, countView, recentFromPlayers, fromRow, hasDb, profileUrl, siteBase, shareProfileUrl, displayUrl,
    ICON, initNav, reveal, copyText, shareLink, qrSvg, reducedMotion, parseVideo, videoHtml, VIDEO_LABEL };
})();
