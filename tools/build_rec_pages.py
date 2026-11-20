#!/usr/bin/env python3
"""Writes the HTML shells for the recruiting tools so their header, nav and footer stay identical.
Run after editing: python3 tools/build_rec_pages.py"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = "22"
BASE = "https://dawsonjones1010-ux.github.io/peach-state-recruits/"

NAV = [("players.html", "Players"), ("find-my-level.html", "Find My Level"),
       ("colleges.html", "Colleges"), ("camps.html", "Camps"), ("email-coach.html", "Email Coach"), ("my-recruiting.html", "My Recruiting"),
       ("index.html#how", "How to order"), ("index.html#faq", "FAQ")]

def page(fname, title, desc, h1, lead, body, scripts, current, robots=False, sub=""):
    nav = "\n      ".join('<a href="{}"{}>{}</a>'.format(h, ' aria-current="page"' if h == current else "", t) for h, t in NAV)
    mnav = "\n    ".join(f'<a href="{h}">{t}</a>' for h, t in NAV)
    extra_styles = f'<link rel="stylesheet" href="recruiting/email.css?v={V}">' if "recruiting/email-ui.js" in scripts else ""
    js = "\n".join(f'<script src="{s}?v={V}"></script>' for s in scripts)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
{'<meta name="robots" content="noindex,nofollow">' if robots else f'<link rel="canonical" href="{BASE}{fname}">'}
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{BASE}images/share.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="favicon.png">
<link rel="icon" sizes="any" href="favicon.ico">
<link rel="apple-touch-icon" href="images/apple-touch-icon.png">
<meta name="theme-color" content="#070b14">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css?v={V}">
<link rel="stylesheet" href="recruiting/rec.css?v={V}">
{extra_styles}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <div class="wrap">
    <a class="logo" href="index.html" id="logo" aria-label="Peach State Recruits home"><img class="logo-mark" src="images/logo-160.png" alt="" width="44" height="44" decoding="async"><span class="logo-text"><b>Peach State</b> Recruits</span></a>
    <nav class="nav-links" aria-label="Main">
      {nav}
    </nav>
    <div class="nav-right">
      <a class="btn btn-peach btn-sm" href="index.html#packages">Get featured</a>
      <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="mobileMenu" aria-label="Menu"><span></span></button>
    </div>
  </div>
  <nav class="mobile-menu" id="mobileMenu" aria-label="Mobile">
    {mnav}
    <a class="btn btn-peach btn-block" href="index.html#packages">Get featured</a>
  </nav>
</header>
<main id="main" class="rc-page">
<section class="rc-intro">
  <div class="rc-wrap">
    <h1>{h1}</h1>
    <p>{lead}</p>
    {sub}
  </div>
</section>
<div class="rc-wrap rc-body">
  <div id="demo"></div>
{body}
</div>
</main>
<footer>
  <div class="wrap">
    <div>
      <div class="logo" id="footLogo"><img class="logo-mark" src="images/logo-160.png" alt="" width="44" height="44" decoding="async"><span class="logo-text"><b>Peach State</b> Recruits</span></div>
      <p style="max-width:28em">A baseball media brand creating player features, highlight videos and recruiting profiles for high school and travel ball players.</p>
    </div>
    <div>
      <h5>Recruiting tools</h5>
      <a href="colleges.html">College Finder</a>
      <a href="camps.html">Camp Finder</a>
      <a href="email-coach.html">Email Coach</a>
      <a href="my-recruiting.html">My Recruiting</a>
      <a href="find-my-level.html">Find My Level</a>
    </div>
    <div>
      <h5>Explore</h5>
      <a href="index.html#examples">Examples</a>
      <a href="index.html#packages">Packages</a>
      <a href="players.html">All players</a>
      <a href="index.html#faq">FAQ</a>
    </div>
    <div class="legal">
      <span id="copy"></span>
      <span>We create player content and recruiting tools. We are not a recruiting agency and do not guarantee college interest, offers or scholarships. School and camp details can change. Always confirm on the official page.</span>
    </div>
  </div>
</footer>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js?v={V}"></script>
<script src="shared.js?v={V}"></script>
<script src="recruiting/logic.js?v={V}"></script>
<script src="recruiting/data.js?v={V}"></script>
<script src="recruiting/ui.js?v={V}"></script>
{js}
<script>document.getElementById("copy").textContent = "\\u00a9 " + new Date().getFullYear() + " Peach State Recruits"; try {{ window.PSR.logoMark(window.PSR_CONFIG || {{}}); }} catch (e) {{}}</script>
</body>
</html>
"""

PAGES = [
    ("colleges.html",
     "College Finder: Baseball Programs | Peach State Recruits",
     "Search college baseball programs by level, state and conference. Official links, last-checked dates and College Scorecard academics. Save schools to your free list.",
     "College Finder",
     "Search college baseball programs across NCAA D1, D2, D3, NAIA and junior college. Save schools to your list and track every email.",
     """  <div id="finder" class="rc-cols">
    <aside id="side"></aside>
    <section id="results" aria-live="polite"><div class="rc-empty">Loading programs…</div></section>
  </div>
  <div id="detail" class="rc-hide"></div>""",
     ["recruiting/colleges.js"], "colleges.html", False,
     '<div class="rc-sub"><span><b id="total">1,600+</b> programs</span><span>Official links + last-checked dates</span><span>Free</span></div>'),
    ("my-recruiting.html",
     "My Recruiting: Plan, Saved Schools and Coach Emails | Peach State Recruits",
     "Your private recruiting workspace: next steps, saved schools, coach email drafts, a message tracker and saved camps.",
     "My Recruiting",
     "Your next steps, saved schools, coach emails and follow-ups in one private place.",
     """  <div id="app" aria-live="polite"><div class="rc-empty">Loading…</div></div>""",
     ["recruiting/research.js", "recruiting/email.js", "recruiting/email-ui.js", "recruiting/hub.js"], "my-recruiting.html", True),
    ("camps.html",
     "Camp Finder: College Baseball Camps | Peach State Recruits",
     "Upcoming college baseball prospect camps from official school and registration pages. Dates, price, eligible grades, calendar export and travel cost estimates.",
     "Camp Finder",
     "Upcoming college baseball camps from official event pages. Save camps, add them to your calendar and estimate travel costs.",
     """  <div class="rc-cols">
    <aside id="side"></aside>
    <section id="results" aria-live="polite"><div class="rc-empty">Loading camps…</div></section>
  </div>""",
     ["recruiting/camps.js"], "camps.html", False),
    ("admin-recruiting.html",
     "Recruiting directory admin | Peach State Recruits",
     "Owner tools for the program directory, camps and recruiting rules.",
     "Directory admin",
     "Import, review and edit programs, camps and recruiting rules. Changes publish to the College Finder and Camp Finder.",
     """  <div id="app" aria-live="polite"><div class="rc-empty">Loading…</div></div>""",
     ["recruiting/admin.js"], "", True),
]

for fname, title, desc, h1, lead, body, scripts, cur, robots, *rest in PAGES:
    sub = rest[0] if rest else ""
    with open(os.path.join(ROOT, fname), "w") as f:
        f.write(page(fname, title, desc, h1, lead, body, scripts, cur, robots, sub))
    print("wrote", fname)
