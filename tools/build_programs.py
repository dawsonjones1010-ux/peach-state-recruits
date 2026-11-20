#!/usr/bin/env python3
"""Build the national baseball program directory from the public listing files in tools/program_lists/.

Outputs:
  data/programs.json                      - fallback directory used when the database is offline / demo mode
  data/programs-directory.csv             - the same rows, for review in a spreadsheet
  supabase/seed/programs_seed.sql         - idempotent upsert into public.programs (by slug)

Listing rows are NOT treated as verified. A row becomes "verified" only when a person has opened the
school's official athletics page and recorded the link + date (VERIFIED below, or the admin screen).
"""
import csv, json, re, os, sys
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "program_lists")

LISTS = [
    ("d1.txt",   "NCAA D1", "Wikipedia: List of NCAA Division I baseball programs (accessed 2026-11-19)",
     "https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_baseball_programs"),
    ("d2.txt",   "NCAA D2", "Wikipedia: List of NCAA Division II baseball programs (accessed 2026-11-19)",
     "https://en.wikipedia.org/wiki/List_of_NCAA_Division_II_baseball_programs"),
    ("d3.txt",   "NCAA D3", "ProductiveRecruit public list of NCAA D3 baseball programs (accessed 2026-11-19)",
     "https://productiverecruit.com/baseball/division-3-colleges"),
    ("naia.txt", "NAIA",    "ProductiveRecruit public list of NAIA baseball programs (accessed 2026-11-19)",
     "https://productiverecruit.com/baseball/naia-colleges"),
    ("juco.txt", "JUCO",    "ProductiveRecruit public list of junior college baseball programs (accessed 2026-11-19)",
     "https://productiverecruit.com/baseball/junior-colleges"),
]

# Programs whose official roster page was opened and read on 2026-11-19 (roster size study).
VERIFIED = {
    ("University of Georgia", "NCAA D1"): "https://georgiadogs.com/sports/baseball/roster",
    ("Clemson University", "NCAA D1"): "https://clemsontigers.com/sports/baseball/roster",
    ("Indiana University Bloomington", "NCAA D1"): "https://iuhoosiers.com/sports/baseball/roster",
    ("Kennesaw State University", "NCAA D1"): "https://ksuowls.com/sports/baseball/roster",
    ("Georgia Southern University", "NCAA D1"): "https://gseagles.com/sports/baseball/roster",
    ("Dallas Baptist University", "NCAA D1"): "https://dbupatriots.com/sports/baseball/roster",
    ("Coastal Carolina University", "NCAA D1"): "https://goccusports.com/sports/baseball/roster",
    ("Jackson State University", "NCAA D1"): "https://gojsutigers.com/sports/baseball/roster",
    ("Coppin State University", "NCAA D1"): "https://coppinstatesports.com/sports/baseball/roster",
    ("Alabama A&M University", "NCAA D1"): "https://aamusports.com/sports/baseball/roster",
    ("University of West Florida", "NCAA D1"): "https://goargos.com/sports/baseball/roster",
    ("Valdosta State", "NCAA D2"): "https://vstateblazers.com/sports/baseball/roster",
    ("Columbus State", "NCAA D2"): "https://csucougars.com/sports/baseball/roster",
    ("Emory University", "NCAA D3"): "https://emoryathletics.com/sports/baseball/roster",
    ("Johns Hopkins University", "NCAA D3"): "https://hopkinssports.com/sports/baseball/roster",
    ("Berry College", "NCAA D3"): "https://berryvikings.com/sports/baseball/roster",
    ("Georgia Gwinnett College", "NAIA"): "https://ggcathletics.com/sports/baseball/roster",
    ("Southeastern University", "NAIA"): "https://fire.seu.edu/sports/baseball/roster/2026",
    ("Lewis-Clark State College", "NAIA"): "https://lcwarriors.com/sports/baseball/roster",
    ("Jones College", "JUCO"): "https://jcbobcats.com/sports/baseball/roster/2026",
    ("San Jacinto College", "JUCO"): "https://sanjacsports.com/sports/baseball/roster",
}
VERIFIED_ON = "2026-11-19"

# Listing rows that conflict with other public reports (closure, merger, wrong association).
# They stay visible but are marked "needs_review" until an admin checks them.
REVIEW = {
    "Wells College": "Reported closed in 2024. Confirm before showing as active.",
    "Eastern Nazarene College": "Reported closed in 2024. Confirm before showing as active.",
    "Medaille University": "Reported closed in 2023. Confirm before showing as active.",
    "Northland College": "Reported closed in 2025. Confirm before showing as active.",
    "Fontbonne University": "Reported closed in 2025. Confirm before showing as active.",
    "Rosemont College": "Reported merged into Villanova in 2025. Confirm before showing as active.",
    "Castleton University": "Now part of Vermont State University (also listed). Likely duplicate.",
    "CUNY York College": "Listed as NAIA by the source; York College (CUNY) is usually NCAA D3. Confirm association.",
    "University of West Florida": "Moving from NCAA D2 (Gulf South) to D1 (ASUN). Confirm current division for this season.",
    "Shawnee State University": "Conference listed by the source is unclear. Confirm.",
    "Southern University at New Orleans": "Conference listed by the source is unclear. Confirm.",
}

def slugify(s):
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-+", "-", s)

def association_for(level, conf):
    if level.startswith("NCAA"): return "NCAA"
    if level == "NAIA": return "NAIA"
    c = (conf or "").upper()
    if "CCCAA" in c: return "CCCAA"
    if "NWAC" in c: return "NWAC"
    return "NJCAA"

def main():
    rows, seen = [], {}
    for fname, level, src_name, src_url in LISTS:
        with open(os.path.join(SRC, fname)) as f:
            for line in f:
                line = line.rstrip("\n")
                if not line.strip(): continue
                parts = (line.split("|") + ["", "", "", ""])[:4]
                name, city, state, conf = [p.strip() for p in parts]
                if conf in ("—", "-"): conf = ""
                base = slugify(name)
                slug = base if base not in seen else f"{base}-{slugify(level)}"
                n = 2
                while slug in seen:
                    slug = f"{base}-{n}"; n += 1
                seen[slug] = True
                r = {
                    "slug": slug, "name": name, "level": level,
                    "association": association_for(level, conf),
                    "conference": conf or None, "city": city or None, "state": state or None,
                    "listing_source": src_name, "listing_source_url": src_url,
                    "record_status": "unverified", "last_checked": None,
                    "athletics_url": None, "roster_url": None, "review_note": None,
                }
                v = VERIFIED.get((name, level))
                if v:
                    u = urlparse(v)
                    r.update(roster_url=v, athletics_url=f"{u.scheme}://{u.netloc}/sports/baseball",
                             record_status="verified", last_checked=VERIFIED_ON)
                if name in REVIEW:
                    r["record_status"] = "needs_review"
                    r["review_note"] = REVIEW[name]
                rows.append(r)

    missing = [k for k in VERIFIED if not any(r["name"] == k[0] and r["level"] == k[1] for r in rows)]
    if missing:
        print("VERIFIED entries not found in lists:", missing, file=sys.stderr); sys.exit(1)

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    with open(os.path.join(ROOT, "data", "programs.json"), "w") as f:
        sources = {lv: {"name": n, "url": u} for _, lv, n, u in LISTS}
        slim = [{k: v for k, v in r.items() if v is not None and k not in ("listing_source", "listing_source_url")} for r in rows]
        json.dump({"generated": VERIFIED_ON, "count": len(rows), "sources": sources, "programs": slim}, f, separators=(",", ":"))
    cols = list(rows[0].keys())
    with open(os.path.join(ROOT, "data", "programs-directory.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)

    def q(v):
        if v is None: return "null"
        return "'" + str(v).replace("'", "''") + "'"
    os.makedirs(os.path.join(ROOT, "supabase", "seed"), exist_ok=True)
    out = ["-- Generated by tools/build_programs.py. Safe to re-run: upserts by slug and never",
           "-- overwrites a row an admin has already verified or edited (record_status <> 'unverified').",
           "begin;"]
    chunk = 200
    for i in range(0, len(rows), chunk):
        vals = ",\n".join("(" + ",".join(q(r[c]) for c in cols) + ")" for r in rows[i:i+chunk])
        out.append(f"insert into public.programs ({','.join(cols)}) values\n{vals}\n"
                   "on conflict (slug) do update set name=excluded.name, level=excluded.level, association=excluded.association,\n"
                   "  conference=excluded.conference, city=excluded.city, state=excluded.state, listing_source=excluded.listing_source,\n"
                   "  listing_source_url=excluded.listing_source_url, record_status=excluded.record_status, last_checked=excluded.last_checked,\n"
                   "  athletics_url=excluded.athletics_url, roster_url=excluded.roster_url, review_note=excluded.review_note\n"
                   "where public.programs.record_status = 'unverified';")
    out.append("commit;")
    with open(os.path.join(ROOT, "supabase", "seed", "programs_seed.sql"), "w") as f:
        f.write("\n".join(out) + "\n")

    from collections import Counter
    print("programs:", len(rows), dict(Counter(r["level"] for r in rows)),
          dict(Counter(r["record_status"] for r in rows)))

if __name__ == "__main__":
    main()


def build_rules_camps_sql():
    """supabase/seed/rules_camps_seed.sql from data/recruiting-seed.json"""
    seed = json.load(open(os.path.join(ROOT, "data", "recruiting-seed.json")))
    def q(v):
        if v is None: return "null"
        if isinstance(v, list): return "'{" + ",".join(str(x) for x in v) + "}'"
        if isinstance(v, (int, float)): return str(v)
        return "'" + str(v).replace("'", "''") + "'"
    out = ["-- Generated by tools/build_programs.py from data/recruiting-seed.json", "begin;"]
    rc = ["rule_key","level","topic","summary","applies_when","source_name","source_url","last_checked","record_status"]
    for r in seed["rules"]:
        out.append(f"insert into public.recruiting_rules ({','.join(rc)}) values ({','.join(q(r[c]) for c in rc)})\n"
                   "on conflict (rule_key) do update set " + ", ".join(f"{c}=excluded.{c}" for c in rc if c != "rule_key") + ";")
    cc = ["id","title","host_name","camp_type","start_date","end_date","time_note","venue","city","state","price_cents","price_note","grad_years","eligibility_note","registration_url","source_url","confirmed_coaches","record_status","last_checked"]
    for c in seed["camps"]:
        out.append(f"insert into public.camps (program_id,{','.join(cc)}) values ((select id from public.programs where slug={q(c['program_slug'])}),{','.join(q(c[k]) for k in cc)})\n"
                   "on conflict (id) do update set " + ", ".join(f"{k}=excluded.{k}" for k in cc if k != "id") + ";")
    out.append("commit;")
    open(os.path.join(ROOT, "supabase", "seed", "rules_camps_seed.sql"), "w").write("\n".join(out) + "\n")
    print("rules:", len(seed["rules"]), "camps:", len(seed["camps"]))

if __name__ == "__main__":
    build_rules_camps_sql()
