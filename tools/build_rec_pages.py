#!/usr/bin/env python3
"""Writes the HTML shells for the recruiting tools so their header, nav and footer stay identical.
Run after editing: python3 tools/build_rec_pages.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mobile_menu import mobile_menu
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = "38"
BASE = "https://dawsonjones1010-ux.github.io/peach-state-recruits/"

NAV = [('players.html', 'Players'), ('recruiting-roadmap.html', 'Start Here'), ('find-my-level.html', 'Find My Level'), ('colleges.html', 'Colleges'), ('email-coach.html', 'Email Coach'), ('my-recruiting.html', 'My Recruiting'), ('index.html#packages', 'Packages')]

def page(fname, title, desc, h1, lead, body, scripts, current, robots=False, sub=""):
    nav = "\n      ".join('<a href="{}"{}>{}</a>'.format(h, ' aria-current="page"' if h == current else "", t) for h, t in NAV)
    extra_styles = f'<link rel="stylesheet" href="recruiting/email.css?v={V}">' if "recruiting/email-ui.js" in scripts else ""
    scripts = list(scripts)
    if "recruiting/colleges.js" in scripts: scripts.insert(0, "recruiting/roadmap.js")
    if "recruiting/email.js" in scripts: scripts.insert(0, "recruiting/calendar.js")
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
{mobile_menu()}
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
  <div id="coverage"></div>
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
      <a href="recruiting-roadmap.html">Start Here</a>
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
      <span><a href="privacy.html">Privacy Policy</a> &middot; <a href="terms.html">Terms</a></span>
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

PRIVACY_BODY = r'''  <article class="rc-panel legal-doc">
    <p class="rc-muted">Last updated November 20, 2026</p>
    <p>Peach State Recruits ("we", "us") makes player features, highlight videos, player profiles and free recruiting tools for high school baseball players. This policy explains what information we collect, why, and the choices you have. Questions: <a class="rc-link" href="mailto:peachstaterecruitshq@gmail.com">peachstaterecruitshq@gmail.com</a>.</p>

    <h2>Who our tools are for</h2>
    <p>Our tools are for high school and junior college players, their parents and their coaches. You must be 13 or older to create an account or send us information. If you're under 18, use our tools with your parent or guardian's knowledge. We don't knowingly collect information from children under 13. If you think a child under 13 has given us information, email us and we'll delete it.</p>

    <h2>What we collect and why</h2>
    <h3>Find My Level</h3>
    <p>The metrics you enter stay on your device (in your browser's storage) so you can see your history. They're sent to us only if you tap <b>Send</b> to ask for a free look. Then we receive your Instagram handle, class, positions, bats/throws, the metrics you entered, how they were measured and your result, so we can reply to you on Instagram.</p>
    <h3>My Recruiting, College Finder and Camp Finder accounts</h3>
    <p>To sign in, you give us your email address and we email you a sign-in link. Anything you save is stored in your private account: your recruiting profile (name, class, school, team, position, size, academics, metrics, contact details and links), saved schools and notes, coach names and emails you enter, email drafts, the messages you log, your plan and saved camps. Only you can see this information. As the site owner, we see only totals (for example, how many schools have been saved), not your details.</p>
    <h3>Featured player profiles</h3>
    <p>When you buy a feature, we collect the information you or your parent send us (name, school, team, position, class, height, weight, stats, academics, links, photos and video) to make your Instagram post and your public player profile. Your profile is public on purpose so coaches can find it. We only publish what you've provided, and you can ask us to change or remove it at any time. If we give you a player login, you can edit your own profile.</p>
    <h3>Orders</h3>
    <p>Orders happen through Instagram messages. We keep a record of the order: buyer and player name, how to contact you, the package, the price and whether it's paid and delivered.</p>
    <h3>Visitor counts</h3>
    <p>We count page visits without cookies. For each page view we store only the page, the name of the website that sent you (for example instagram.com), any campaign tag in the link (like <code>utm_source</code>) and whether you're on a phone, tablet or computer. We don't store your IP address or any identifier, and we can't tell who you are. If your browser sends Do Not Track or Global Privacy Control, we don't count your visit. Player profile pages also count views the same anonymous way.</p>
    <h3>Recruiting Roadmap worksheets</h3>
    <p>Your plan, camp and cost entries stay in this page unless you choose to keep them on this device. The saved worksheet is separate from My Recruiting and can be opened by someone using the same browser. Use Clear worksheet or clear browser site data to remove it.</p>
    <h3>Your browser's storage</h3>
    <p>We use your browser's local storage to remember things on your device, like your Find My Level history, email drafts and whether you've already been counted this visit. We don't use advertising cookies or tracking pixels.</p>

    <h2>What we don't do</h2>
    <p>We don't sell your information, share it for advertising or send it to recruiting services. We don't email coaches for you: you decide what to send and send it yourself.</p>

    <h2>Services we use</h2>
    <p>These companies host or deliver parts of the site and handle data only to provide their service:</p>
    <ul>
      <li><b>Supabase</b>: our database and email sign-in.</li>
      <li><b>GitHub Pages</b>: hosts the website. Like most web hosts, it may keep standard server logs, such as IP addresses.</li>
      <li><b>Google Fonts</b> and <b>jsDelivr</b>: deliver fonts and code to your browser, which means they receive your IP address.</li>
      <li><b>Instagram (Meta)</b>: orders and messages, and Instagram posts you choose to play on a profile.</li>
    </ul>

    <h2>How long we keep it</h2>
    <p>We keep account data until you delete it or ask us to. Free-look requests are kept while we review them and for our records. Visitor counts contain no personal information.</p>

    <h2>Your choices</h2>
    <ul>
      <li><b>Delete your recruiting data yourself:</b> in My Recruiting, open Profile and tap <b>Delete my recruiting data</b>.</li>
      <li><b>Ask us to see, correct or delete anything else</b>, including your sign-in account, a free-look request or a featured profile: email <a class="rc-link" href="mailto:peachstaterecruitshq@gmail.com">peachstaterecruitshq@gmail.com</a>. We'll answer within 30 days. A parent or guardian can make these requests for a player under 18.</li>
      <li><b>Clear what's stored on your device</b> by clearing your browser's site data.</li>
    </ul>

    <h2>Security</h2>
    <p>Your account data is protected by row-level security, so each account can only read its own records. No system is perfect, so don't save anything in your notes you wouldn't want exposed, like passwords or ID numbers.</p>

    <h2>Changes</h2>
    <p>If we change this policy, we'll update the date at the top. Big changes will be announced on the site.</p>
  </article>'''
TERMS_BODY = r'''  <article class="rc-panel legal-doc">
    <p class="rc-muted">Last updated November 20, 2026</p>
    <p>These terms cover your use of the Peach State Recruits website and its free tools (Find My Level, College Finder, Camp Finder, Email Coach and My Recruiting). By using the site, you agree to them. If you're under 18, a parent or guardian should review them with you. Also see our <a class="rc-link" href="privacy.html">Privacy Policy</a>.</p>

    <h2>What we are</h2>
    <p>Peach State Recruits is a baseball media brand. We create player content and recruiting tools. We are not a recruiting agency, and we don't guarantee college interest, offers, roster spots or scholarships.</p>

    <h2>Our tools are guides, not promises</h2>
    <ul>
      <li><b>Find My Level</b> compares the metrics you enter with published benchmarks. It's an estimate, not an evaluation by a coach, and it doesn't predict where you'll play.</li>
      <li><b>College Finder and Camp Finder</b> come from public listings and official pages. Programs, rosters, dates, prices and rules change. Always confirm on the school's or event's official page before you act or pay.</li>
      <li><b>Recruiting rules and dates</b> are summaries with links to their sources. You and your family are responsible for following NCAA, NAIA and NJCAA rules. Check with the official source or a school's compliance office.</li>
      <li><b>Email Coach and My Recruiting</b> help you write and track messages. You choose what to send and are responsible for what you send.</li>
    </ul>

    <h2>Your account</h2>
    <p>You must be 13 or older to create an account. Keep access to your email secure, since that's how you sign in. Use your own real information and don't sign in as someone else.</p>

    <h2>What you share with us</h2>
    <p>You keep ownership of your photos, videos, stats and other content. When you buy a feature or send us content, you give us permission to use it to make your post, video and player profile and to show them on our Instagram accounts and website. You can ask us to take your profile down at any time. Only send content you have the right to share.</p>

    <h2>Orders</h2>
    <p>Prices and what each package includes are listed under <a class="rc-link" href="index.html#packages">Packages</a>. Orders are confirmed through Instagram messages. If something isn't right with your order, message us and we'll work with you to fix it.</p>

    <h2>Please don't</h2>
    <ul>
      <li>Post false information about yourself or anyone else, or use someone else's name, photos or film without permission.</li>
      <li>Use the tools to spam coaches or anyone else.</li>
      <li>Copy our directory or content in bulk, use bots on the site, or try to get into accounts or data that aren't yours.</li>
    </ul>

    <h2>Not affiliated</h2>
    <p>We aren't affiliated with or endorsed by the NCAA, NAIA, NJCAA, any college, or any camp or registration service. School and camp names belong to their owners and are used only to identify them.</p>

    <h2>No warranty, limited liability</h2>
    <p>The site and tools are provided "as is". We work to keep information accurate but can't guarantee it's complete, current or error-free. To the extent the law allows, we're not responsible for decisions you make based on the site, such as camp fees, travel or which schools you contact.</p>

    <h2>Changes</h2>
    <p>We may update these terms. The date at the top shows the latest version. Questions: <a class="rc-link" href="mailto:peachstaterecruitshq@gmail.com">peachstaterecruitshq@gmail.com</a>.</p>
  </article>'''

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
    ("privacy.html",
     "Privacy Policy | Peach State Recruits",
     "What Peach State Recruits collects, why, and how to delete it. No advertising cookies; Find My Level metrics stay on your device unless you send them.",
     "Privacy Policy",
     "What we collect, why, and how to delete it. In short: we don't sell your information, your recruiting account is private to you, and visitor counts use no cookies.",
     PRIVACY_BODY, [], "", False),
    ("terms.html",
     "Terms of Use | Peach State Recruits",
     "The rules for using the Peach State Recruits website, Find My Level and the free recruiting tools.",
     "Terms of Use",
     "The basics for using our site and free recruiting tools.",
     TERMS_BODY, [], "", False),
]

for fname, title, desc, h1, lead, body, scripts, cur, robots, *rest in PAGES:
    sub = rest[0] if rest else ""
    with open(os.path.join(ROOT, fname), "w") as f:
        f.write(page(fname, title, desc, h1, lead, body, scripts, cur, robots, sub))
    print("wrote", fname)
