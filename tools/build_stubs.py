#!/usr/bin/env python3
"""Build static share pages for every published player.

Writes, for each published player:
  player/<slug>/index.html   a copy of player.html with that player's title, description
                             and Open Graph / Twitter tags baked in (link previews on
                             iMessage, Instagram DMs, X, Facebook, Slack...). It renders the
                             normal profile in the browser, so nothing else changes.
  images/og/<slug>.jpg       a 1200x630 preview card made from the cover (own covers only)
Also writes sitemap.xml.

Run from the repo root after adding or editing players:  python3 tools/build_stubs.py
Players come from Supabase (published only) or players.json if the database is unreachable.
"""
import html, json, os, re, shutil, sys, urllib.request
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://dawsonjones1010-ux.github.io/peach-state-recruits"
os.chdir(ROOT)

def cfg(key):
    m = re.search(key + r':\s*"([^"]*)"', open("config.js", encoding="utf-8").read())
    return m.group(1) if m else ""

def load_players():
    url, key = cfg("supabaseUrl"), cfg("supabaseAnonKey")
    if url and key:
        try:
            req = urllib.request.Request(f"{url}/rest/v1/players?published=eq.true&select=*&order=posted_at.desc.nullslast",
                                         headers={"apikey": key, "Authorization": f"Bearer {key}"})
            rows = json.load(urllib.request.urlopen(req, timeout=20))
            if rows:
                return [{"slug": r["slug"], "name": r["name"], "sport": r.get("sport"), "position": r.get("position"),
                         "gradYear": r.get("grad_year"), "school": r.get("school"), "team": r.get("team"),
                         "location": r.get("location"), "headline": r.get("headline") or "", "cover": r.get("cover_url") or "",
                         "updated": (r.get("updated_at") or r.get("posted_at") or "")[:10]} for r in rows]
        except Exception as e:
            print("database unavailable, using players.json:", e, file=sys.stderr)
    out = []
    for p in json.load(open("players.json", encoding="utf-8")):
        if p.get("active") is False or p.get("sample"):
            continue
        out.append({**p, "cover": p.get("coverImage") or "", "updated": ""})
    return out

def clean(t):  # drop emoji for image text
    return re.sub(r"[^\u0000-\u024F\u2018-\u201D ]", "", str(t or "")).strip()

def og_card(p, src_path, dest):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
    W, H = 1200, 630
    im = Image.open(src_path).convert("RGB")
    bg = im.copy(); bg.thumbnail((W, W))
    s = max(W / bg.width, H / bg.height); bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1))
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(40))).enhance(.38)
    shade = Image.new("RGB", (W, H), (7, 11, 20)); mask = Image.linear_gradient("L").rotate(90).resize((W, H))
    bg = Image.composite(bg, shade, mask.point(lambda v: min(255, int(v * 1.4))))
    ch = H - 80; cw = int(im.width * ch / im.height)
    if cw > 560: cw = 560; ch = int(im.height * cw / im.width)
    cov = im.resize((cw, ch), Image.LANCZOS)
    x0 = W - 60 - cw; y0 = (H - ch) // 2
    bg.paste(cov, (x0, y0))
    d = ImageDraw.Draw(bg)
    d.rectangle([x0 - 1, y0 - 1, x0 + cw, y0 + ch], outline=(255, 255, 255, 40))
    A = lambda n: ImageFont.truetype("tools/fonts/Anton.ttf", n)
    B = lambda n: ImageFont.truetype("tools/fonts/Barlow.ttf", n)
    peach = (255, 138, 76)
    maxw = x0 - 60 - 60
    if os.path.exists("images/logo.png"):
        badge = Image.open("images/logo.png").convert("RGBA").resize((64, 64), Image.LANCZOS)
        bg.paste(badge, (56, 48), badge)
        d.text((134, 80), "PEACH STATE RECRUITS", font=B(26), fill=(255, 255, 255), anchor="lm")
    else:
        d.rounded_rectangle([60, 56, 108, 104], 10, fill=peach)
        d.text((84, 80), "PSR", font=A(19), fill=(7, 11, 20), anchor="mm")
        d.text((124, 80), "PEACH STATE RECRUITS", font=B(26), fill=(255, 255, 255), anchor="lm")
    parts = clean(p["name"]).upper().split()
    lines = [" ".join(parts[:-1]), parts[-1]] if len(parts) > 1 else parts
    y = 170
    for i, ln in enumerate([l for l in lines if l]):
        n = 110
        while A(n).getlength(ln) > maxw and n > 40: n -= 4
        d.text((56, y), ln, font=A(n), fill=peach if i == len(lines) - 1 else (255, 255, 255))
        y += int(n * 1.08)
    meta = " · ".join(str(x) for x in [p.get("position"), p.get("gradYear") and f"CLASS OF {p['gradYear']}"] if x).upper()
    d.text((60, y + 14), meta, font=B(32), fill=(255, 178, 125))
    sub = clean(p.get("school") or p.get("team") or p.get("location"))
    if sub:
        n = 26
        while B(n).getlength(sub) > maxw and n > 16: n -= 1
        d.text((60, y + 58), sub, font=B(n), fill=(255, 255, 255, 190))
    d.rectangle([60, H - 70, 60 + 46, H - 66], fill=peach)
    d.text((60, H - 56), "RECRUITING PROFILE", font=B(22), fill=(255, 255, 255))
    bg.save(dest, quality=84, optimize=True, progressive=True)

def local_cover(cover):
    m = re.search(r"(images/players/[\w-]+\.jpg)", cover or "")
    return m.group(1) if m and os.path.exists(m.group(1)) else ""

def ensure_small_covers():
    """Every images/players/<slug>.jpg gets a 640px copy for cards and phones."""
    from PIL import Image
    for f in os.listdir("images/players"):
        if not f.endswith(".jpg") or f.endswith("-640.jpg"):
            continue
        src = os.path.join("images/players", f); dst = src[:-4] + "-640.jpg"
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = Image.open(src).convert("RGB"); im.thumbnail((640, 640), Image.LANCZOS)
        im.save(dst, quality=80, optimize=True, progressive=True)
        print("made", dst)

def main():
    ensure_small_covers()
    tpl = open("player.html", encoding="utf-8").read()
    players = load_players()
    keep = set()
    if os.path.isdir("player"):
        shutil.rmtree("player")
    for p in players:
        slug = p["slug"]
        if not re.fullmatch(r"[\w-]+", slug or ""):
            continue
        keep.add(slug)
        cls = f"Class of {p['gradYear']}" if p.get("gradYear") else ""
        bits = [x for x in ["Baseball", p.get("position"), cls] if x]
        title = f"{p['name']} | {' · '.join(bits)} | Peach State Recruits"
        where = p.get("school") or p.get("team") or p.get("location") or ""
        hl = (p.get("headline") or "").strip()
        if hl and hl[-1].isalnum():
            hl += "."
        desc = (hl + " " if hl else f"{p['name']}. ") + ", ".join([b for b in bits + [where] if b]) + \
               ". Highlights, measurables and scouting report."
        lc = local_cover(p.get("cover"))
        if lc:
            og_card(p, lc, f"images/og/{slug}.jpg")
            img = f"{SITE}/images/og/{slug}.jpg"; iw, ih = 1200, 630
        else:
            c = p.get("cover") or ""
            img = c if c.startswith("http") else (f"{SITE}/{c}" if c else f"{SITE}/images/share.jpg"); iw = ih = None
        url = f"{SITE}/player/{slug}/"
        e = lambda t: html.escape(str(t), quote=True)
        meta = f'''<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{e(url)}">
<meta property="og:title" content="{e(p['name'] + ' | Peach State Recruits')}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:site_name" content="Peach State Recruits">
<meta property="og:image" content="{e(img)}">
{f'<meta property="og:image:width" content="{iw}"><meta property="og:image:height" content="{ih}">' if iw else ''}
<meta property="og:image:alt" content="{e(p['name'] + ' feature cover')}">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(p['name'] + ' | Peach State Recruits')}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(img)}">'''
        out = re.sub(r"<title>.*?</title>\s*<meta name=\"description\"[^>]*>", lambda m: "<!--og-->", tpl, count=1, flags=re.S)
        out = re.sub(r'<meta property="og:image"[^>]*>\s*<meta property="og:type"[^>]*>\s*<meta name="twitter:card"[^>]*>\s*<meta name="twitter:image"[^>]*>', "", out, count=1)
        out = out.replace("<!--og-->", meta, 1)
        # Static base (the page lives at player/<slug>/), so every asset resolves on first fetch
        out = re.sub(r"<script>\(function\(\)\{var m=location\.pathname.*?</script>", '<base href="../../">', out, count=1)
        assert '<base href="../../">' in out, slug
        assert "og:title" in out and out.count('property="og:image"') == 1, slug
        os.makedirs(f"player/{slug}", exist_ok=True)
        open(f"player/{slug}/index.html", "w", encoding="utf-8").write(out)
    for f in os.listdir("images/og"):
        if f.endswith(".jpg") and f[:-4] not in keep:
            os.remove(os.path.join("images/og", f))
    urls = [f"  <url><loc>{SITE}/</loc></url>", f"  <url><loc>{SITE}/players.html</loc></url>"] + [f"  <url><loc>{SITE}/player/{s}/</loc></url>" for s in sorted(keep)]
    open("sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n")
    print(f"built {len(keep)} player pages:", ", ".join(sorted(keep)))

if __name__ == "__main__":
    main()
