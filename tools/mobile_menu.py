#!/usr/bin/env python3
"""Single source for the phone menu (#mobileMenu), so every page has the same links.

Used by tools/build_rec_pages.py when it writes colleges/camps/my-recruiting/admin-recruiting.
For the hand-written pages run:  python3 tools/mobile_menu.py
It rewrites the #mobileMenu block in index.html, players.html, find-my-level.html,
email-coach.html and player.html (then run tools/build_stubs.py so the 12 player pages copy it).
Only the phone menu changes; the desktop nav and footer are left alone.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUPS = [
    ("mmTools", "Recruiting tools", [("find-my-level.html", "Find My Level"), ("colleges.html", "College Finder"),
                                     ("camps.html", "Camp Finder"), ("my-recruiting.html", "My Recruiting")]),
    ("mmPsr", "Peach State", [("#examples", "Featured Examples"), ("players.html", "All Players"),
                              ("#packages", "Packages &amp; Prices"), ("#faq", "FAQ")]),
]
HOME_PAGES = {"index.html"}  # pages where home anchors stay as #examples etc.

def mobile_menu(on_home=False, indent="  "):
    fix = (lambda h: h) if on_home else (lambda h: "index.html" + h if h.startswith("#") else h)
    i2 = indent + "  "
    out = [f'{indent}<nav class="mobile-menu" id="mobileMenu" aria-label="Mobile">']
    for gid, label, links in GROUPS:
        out.append(f'{i2}<p class="mm-label" id="{gid}">{label}</p>')
        out.append(f'{i2}<ul class="mm-list" aria-labelledby="{gid}">')
        out += [f'{i2}  <li><a href="{fix(h)}">{t}</a></li>' for h, t in links]
        out.append(f'{i2}</ul>')
    out.append(f'{i2}<a class="btn btn-peach btn-block" href="{fix("#packages")}">Get featured</a>')
    out.append(f'{indent}</nav>')
    return "\n".join(out)

BLOCK = re.compile(r'[ \t]*<nav class="mobile-menu" id="mobileMenu"[^>]*>.*?</nav>', re.S)

def apply(path):
    s = open(path, encoding="utf-8").read()
    assert len(BLOCK.findall(s)) == 1, path
    s2 = BLOCK.sub(lambda m: mobile_menu(os.path.basename(path) in HOME_PAGES), s)
    open(path, "w", encoding="utf-8").write(s2)
    return s2 != s

if __name__ == "__main__":
    for f in ["index.html", "players.html", "find-my-level.html", "email-coach.html", "player.html"]:
        print(("updated " if apply(os.path.join(ROOT, f)) else "unchanged ") + f)
