/* Shared helpers for Peach State Recruits pages */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Your logo: set logoImage in config.js (e.g. "images/logo.png"). Until then, only the script wordmark shows.
  // The badge is in the page markup (images/logo-160.png). If config.js names a different
  // logoImage, swap it in; nothing is inserted, so this never duplicates the badge.
  function logoMark(cfg) {
    const src = cfg && cfg.logoImage;
    if (src) document.querySelectorAll("img.logo-mark").forEach(i => { if (i.getAttribute("src") !== src) i.src = src; });
    return "";
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
        <text x="28" y="58" font-family="${F}" font-weight="700" font-size="20" letter-spacing="1.5" fill="#fff">BASEBALL</text>
        <text x="372" y="58" text-anchor="end" font-family="${F}" font-weight="600" font-size="15" letter-spacing="1" fill="#fff" opacity=".55">PEACH STATE RECRUITS</text>
        <text x="28" y="404" font-family="${F}" font-weight="700" font-size="19" letter-spacing=".5" fill="${hue}">${esc([pos, cls].filter(Boolean).join("  |  "))}</text>
        <text x="28" y="440" font-family="${F}" font-weight="600" font-size="34" fill="#fff" opacity=".85">${esc(first)}</text>
        <text x="25" y="486" font-family="${F}" font-weight="800" font-size="${Math.min(64, Math.floor(600 / Math.max(last.length, 1)))}" fill="#fff">${esc(last)}</text>
      </g>
    </svg>`;
  }

  // Frame sizes used by srcset. The box itself keeps its CSS aspect-ratio;
  // the photo is shown in full (object-fit:contain) over a blurred fill.
  const PHOTO_SIZES = {
    card: "(max-width: 700px) 80vw, (max-width: 1100px) 45vw, 380px",
    hero: "(max-width: 900px) 70vw, 420px",
    spot: "92px",
    profile: "(max-width: 760px) 80vw, 460px",
    mini: "(max-width: 700px) 96px, 140px",
    thumb: "56px",
    preview: "220px",
    video: "(max-width: 700px) 92vw, 640px"
  };
  const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "PS";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function photoSrc(p) {
    return (p && (p.coverImage || p.image || p.cover_url)) || "";
  }

  function photoFallback(img) {
    // A missing 640px copy falls back to the full image before giving up
    const full = img && img.getAttribute && img.getAttribute("data-full");
    if (full && img.getAttribute("src") !== full) {
      img.removeAttribute("srcset"); img.setAttribute("src", full);
      const bgEl = img.parentNode && img.parentNode.querySelector(".photo-frame-bg");
      if (bgEl) bgEl.style.backgroundImage = `url('${full.replace(/'/g, "%27")}')`;
      return;
    }
    const frame = img && img.closest && img.closest(".photo-frame");
    if (frame) frame.classList.add("is-fallback");
    if (img) { img.removeAttribute("src"); img.removeAttribute("srcset"); }
  }

  // Reusable cover: the whole photo, any aspect ratio, in a fixed frame.
  // Missing photos get the generated graphic; a broken image falls back to initials on navy.
  function photoFrame(p, opts = {}) {
    const src = photoSrc(p);
    const cls = ["photo-frame", opts.cls].filter(Boolean).join(" ");
    const sizes = opts.sizes || PHOTO_SIZES.card;
    const extra = opts.extra || "";
    const name = (p && p.name) || "Athlete";
    if (!src) {
      return `<div class="${cls} is-generated">${cover(p || {}, { cls: "photo-frame-img" })}${extra}</div>`;
    }
    const safe = esc(src);
    const eager = !!opts.eager;
    // Our own covers (images/players/<slug>.jpg) ship a 640px copy for cards and phones.
    const m = String(src).match(/^(.*\/images\/players\/[\w-]+|images\/players\/[\w-]+)\.jpg(\?.*)?$/);
    const small = m ? esc(m[1] + "-640.jpg" + (m[2] || "")) : "";
    const srcset = small ? `${small} 640w, ${safe} 1600w` : `${safe} 1600w`;
    const bg = small || safe;
    return `<div class="${cls}"><span class="photo-frame-bg" aria-hidden="true" style="background-image:url('${bg}')"></span><img class="photo-frame-img" src="${opts.full ? safe : (small || safe)}" srcset="${srcset}" sizes="${esc(sizes)}"${small ? ` data-full="${safe}"` : ""} alt="${esc(name)} feature cover" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="window.PSR.photoFallback(this)"><span class="photo-frame-ph" aria-hidden="true">${esc(initials(name))}</span>${extra}</div>`;
  }

  function coverOrImage(p, cls, eager) {
    return photoFrame(p, { cls, eager });
  }

  function isHeicFile(file) {
    const t = (file.type || "").toLowerCase();
    const n = (file.name || "").toLowerCase();
    return /image\/hei[cf]/.test(t) || /\.hei[cf]$/.test(n);
  }

  function isImageFile(file) {
    const t = (file.type || "").toLowerCase();
    const n = (file.name || "").toLowerCase();
    return /image\/(jpeg|jpg|pjpeg|png|webp|gif|hei[cf])/.test(t) || /\.(jpe?g|png|webp|gif|hei[cf])$/.test(n);
  }

  let heicLoading = null;
  function loadHeic2any() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (!heicLoading) heicLoading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "vendor/heic2any.min.js?v=1";
      s.async = true;
      s.onload = () => window.heic2any ? res(window.heic2any) : rej(new Error("Couldn't load the HEIC converter."));
      s.onerror = () => rej(new Error("Couldn't load the HEIC converter. Check your connection and try again, or export the photo as a JPG first."));
      document.head.appendChild(s);
    });
    return heicLoading;
  }

  async function blobToBitmap(blob) {
    if (typeof createImageBitmap === "function") {
      try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); }
      catch (e) {
        try { return await createImageBitmap(blob); } catch (e2) {}
      }
    }
    return await new Promise((res, rej) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't read that photo.")); };
      img.src = url;
    });
  }

  // Convert any common photo (JPG, PNG, WebP, GIF, iPhone HEIC) to a reasonably
  // sized JPEG before upload. Max long edge ~1600px, quality ~0.85, EXIF orientation applied.
  async function prepareImageFile(file, opts = {}) {
    const maxEdge = opts.maxEdge || 1600;
    const quality = opts.quality == null ? 0.85 : opts.quality;
    if (!file) throw new Error("Choose a photo first.");
    if (!isImageFile(file) && !isHeicFile(file)) {
      throw new Error("Use a JPG, PNG, WebP, GIF, or an iPhone photo (HEIC).");
    }
    let blob = file;
    if (isHeicFile(file)) {
      try {
        const heic2any = await loadHeic2any();
        blob = await heic2any({ blob: file, toType: "image/jpeg", quality });
        if (Array.isArray(blob)) blob = blob[0];
      } catch (e) {
        const msg = (e && e.message) || String(e || "");
        if (/Couldn't load the HEIC converter/.test(msg)) throw e;
        throw new Error("Couldn't convert that iPhone photo. Try exporting it as a JPG in Photos and upload that instead.");
      }
    }
    let bmp;
    try { bmp = await blobToBitmap(blob); }
    catch (e) { throw new Error("Couldn't read that photo. Try a JPG or PNG, or export it from your phone as a JPG."); }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    if (!w || !h) throw new Error("That photo looks empty. Try a different file.");
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw; canvas.height = th;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a1120";
    ctx.fillRect(0, 0, tw, th);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, tw, th);
    if (bmp.close) try { bmp.close(); } catch (e) {}
    const jpeg = await new Promise((res, rej) => {
      canvas.toBlob(b => b ? res(b) : rej(new Error("Couldn't process that photo.")), "image/jpeg", quality);
    });
    const base = (file.name || "cover").replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").slice(0, 40) || "cover";
    return new File([jpeg], base + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
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
      coachReport: r.coach_report || "", featuredRank: r.featured_rank || null, featureDate: r.feature_date || "",
      headline: r.headline || "", playerInstagram: (r.player_instagram || []).filter(Boolean),
      videos: (r.player_videos || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    };
  }

  // Baseball-only site: rows tagged with another sport never show publicly.
  const isBaseball = (p) => !p || !p.sport || /baseball/i.test(p.sport);
  async function loadPlayers() {
    if (hasDb()) {
      try {
        const h = { headers: { apikey: C().supabaseAnonKey, Authorization: `Bearer ${C().supabaseAnonKey}` } };
        const u = `${C().supabaseUrl}/rest/v1/players?published=eq.true&order=posted_at.desc.nullslast&select=`;
        let r = await fetch(u + encodeURIComponent("*,player_videos(id,kind,url,title,created_at)"), h);
        if (!r.ok) r = await fetch(u + "*", h);
        if (r.ok) { const rows = await r.json(); if (rows.length) return rows.map(fromRow).filter(isBaseball); }
      } catch (e) {}
    }
    try {
      const r = await fetch("players.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      return (await r.json()).filter(isBaseball);
    } catch (e) {
      return (window.PSR_PLAYERS || []).filter(isBaseball);
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
    const live = players.filter(p => p.showOnHome && p.coverImage).slice(0, 9);
    if (!live.length) return C().recentFeatures || [];
    return live.map(p => ({
      name: p.name, sport: p.sport,
      detail: [p.position, p.gradYear ? "Class of " + p.gradYear : "", p.school || p.team].filter(Boolean).join(", "),
      views: p.views, viewsAsOf: p.viewsAsOf, image: p.coverImage, postUrl: p.postUrl,
      profile: p.slug, account: p.account, position: p.position, gradYear: p.gradYear,
      school: p.school || p.team, location: p.location, headline: p.headline, coverImage: p.coverImage
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
    if (p.kind === "youtube") return `<div class="video${/\/shorts\//.test(p.url) ? " is-portrait yt-short" : " is-landscape"}"><iframe src="https://www.youtube-nocookie.com/embed/${esc(p.id)}" title="${t}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    if (p.kind === "vimeo") return `<div class="video is-landscape"><iframe src="https://player.vimeo.com/video/${esc(p.id)}" title="${t}" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    // Uploaded clips keep their own shape: portrait phone clips stay portrait, landscape spans the row.
    if (p.kind === "file") return `<div class="video video-file is-portrait"><video src="${esc(p.url)}#t=0.1" controls playsinline preload="metadata" aria-label="${t}" onloadedmetadata="window.PSR.fitVideo(this)"></video></div>`;
    return `<a class="vlink" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="vlink-ic">${ICON.play}</span><span><b>${esc(v.title || "Watch on " + VIDEO_LABEL[p.kind])}</b><small>${esc(VIDEO_LABEL[p.kind])} · ${esc(displayUrl(p.url)).slice(0, 48)}</small></span><span aria-hidden="true">↗</span></a>`;
  }

  function fitVideo(v) {
    const w = v.videoWidth, h = v.videoHeight, box = v.closest(".video");
    if (!w || !h || !box) return;
    box.style.aspectRatio = `${w} / ${h}`;
    box.classList.toggle("is-portrait", h > w);
    box.classList.toggle("is-landscape", w >= h);
  }

  // Instagram's official embed (blockquote + embed.js), loaded only when someone taps play.
  let igLoading = null;
  function loadIgEmbed() {
    if (window.instgrm) return Promise.resolve(window.instgrm);
    if (!igLoading) igLoading = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "https://www.instagram.com/embed.js"; s.async = true;
      s.onload = () => window.instgrm ? res(window.instgrm) : rej(new Error("embed unavailable"));
      s.onerror = rej; document.head.appendChild(s);
    });
    return igLoading;
  }
  function igPermalink(url) {
    const m = String(url || "").match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/);
    return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : "";
  }
  async function playIg(box, url) {
    const link = igPermalink(url); if (!box || !link) return false;
    box.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="${esc(link)}?utm_source=ig_embed" data-instgrm-version="14" style="margin:0;width:100%;min-width:0;max-width:100%;border:0;background:#fff"><a href="${esc(link)}" target="_blank" rel="noopener">View this post on Instagram</a></blockquote>`;
    box.classList.add("is-embed");
    try { const ig = await loadIgEmbed(); ig.Embeds.process(); return true; }
    catch (e) { box.innerHTML = `<a class="ig-fallback" href="${esc(link)}" target="_blank" rel="noopener">${ICON.ig}<span>Watch the feature on Instagram</span></a>`; return false; }
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
    const navEl = document.querySelector(".nav");
    if (navEl) { const onS = () => navEl.classList.toggle("is-scrolled", window.scrollY > 8); onS(); window.addEventListener("scroll", onS, { passive: true }); }
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

  window.PSR = { esc, LOGO, logoMark, cover, coverOrImage, photoFrame, photoFallback, photoSrc, initials, PHOTO_SIZES, IMAGE_ACCEPT, prepareImageFile, isHeicFile, isImageFile, payLink, toast, loadPlayers, countView, recentFromPlayers, fromRow, hasDb, profileUrl, siteBase, shareProfileUrl, displayUrl,
    ICON, initNav, reveal, fitVideo, playIg, igPermalink, copyText, shareLink, qrSvg, reducedMotion, parseVideo, videoHtml, VIDEO_LABEL };
})();
