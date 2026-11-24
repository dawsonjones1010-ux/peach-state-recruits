#!/usr/bin/env python3
"""Switch the site's public address to a custom domain in one step.

    python3 tools/set_domain.py peachstaterecruits.com            # apply
    python3 tools/set_domain.py peachstaterecruits.com --dry-run  # show what would change

Rewrites every hard-coded https://dawsonjones1010-ux.github.io/peach-state-recruits address
(canonical tags, Open Graph tags, sitemap, robots.txt, player pages, build tools, printed report
footer) to https://<domain>, sets siteUrl in config.js, and writes a CNAME file.

Not done here (needs accounts): buying the domain, DNS records at the registrar, GitHub Pages
custom-domain setting (gh api -X PUT repos/dawsonjones1010-ux/peach-state-recruits/pages -f cname=<domain>),
and the Supabase Auth Site URL / redirect URLs.
"""
import pathlib, re, sys

OLD = "https://dawsonjones1010-ux.github.io/peach-state-recruits"
OLD_BARE = "dawsonjones1010-ux.github.io/peach-state-recruits"
ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "docs", "supabase", "tests"}
EXTS = {".html", ".js", ".py", ".sh", ".xml", ".txt", ".json"}


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    dry = "--dry-run" in argv
    if len(args) != 1 or not re.fullmatch(r"(?:[a-z0-9-]+\.)+[a-z]{2,}", args[0].lower()):
        sys.exit("Usage: python3 tools/set_domain.py example.com [--dry-run]")
    domain = args[0].lower()
    new = "https://" + domain
    changed = []
    for f in sorted(ROOT.rglob("*")):
        if not f.is_file() or f.suffix not in EXTS or SKIP_DIRS & set(f.relative_to(ROOT).parts):
            continue
        if f.name == "set_domain.py":
            continue
        s = f.read_text(encoding="utf-8")
        t = s.replace(OLD, new).replace(OLD_BARE, domain)
        if t != s:
            changed.append(str(f.relative_to(ROOT)))
            if not dry:
                f.write_text(t, encoding="utf-8")
    cfg = ROOT / "config.js"
    s = cfg.read_text(encoding="utf-8")
    t = re.sub(r'siteUrl:\s*"[^"]*"', f'siteUrl: "{new}"', s, count=1)
    if t != s:
        changed.append("config.js (siteUrl)")
        if not dry:
            cfg.write_text(t, encoding="utf-8")
    if not dry:
        (ROOT / "CNAME").write_text(domain + "\n", encoding="utf-8")
    changed.append("CNAME")
    print(("Would change" if dry else "Changed"), len(changed), "files:")
    for c in changed:
        print("  " + c)


if __name__ == "__main__":
    main(sys.argv[1:])
