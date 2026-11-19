"""Build SQL + players.json entries from features.json.
A player is published only when its Instagram post id AND caption are filled in."""
import json, re, sys
BASE = "https://dawsonjones1010-ux.github.io/peach-state-recruits/"
F = json.load(open('/workspace/ig_import/features.json'))
def q(v):
    if v is None: return "null"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"
def bio(cap):
    if not cap: return None
    lines = cap.replace('\r', '').split('\n')
    # drop the header line ("Name | POS | 2027 | ...") and the hashtag line
    if lines and '|' in lines[0]: lines = lines[1:]
    text = '\n'.join(lines)
    text = re.sub(r'(?im)^\s*#peachstaterecruits\s*$', '', text).replace('#peachstaterecruits', '')
    return re.sub(r'\n{3,}', '\n\n', text).strip() or None
vals, pj = [], []
for f in F:
    complete = bool(f.get('post_id') and f.get('bio_caption'))
    post_url = f"https://www.instagram.com/p/{f['post_id']}/" if f.get('post_id') else None
    meas = [{"label": "Height", "value": f['height']}, {"label": "Weight", "value": f['weight']}, {"label": "Position", "value": f['position']}]
    handles = [h.lstrip('@') for h in (f.get('player_instagram') or []) if h]
    posted = q(f['posted_at']) + "::timestamptz" if f.get('posted_at') else f"now() - interval '{f['order']} minutes'"
    b = bio(f.get('bio_caption'))
    vals.append("(" + ", ".join([q(f['slug']), q(f['name']), q('Baseball'), q(f['position']), q(f['grad_year']), q(f['school']),
        q(f.get('team')), q(f.get('location')), q(f['height']), q(f['weight']), q(json.dumps(meas)) + "::jsonb",
        q(b), q(BASE + f['cover']), q(post_url), q('peachstaterecruits'), q('Peach State Recruits'),
        "true" if complete else "false", "true", posted, "false", q(f['headline']),
        "array[" + ",".join(q(h) for h in handles) + "]::text[]"]) + ")")
    if complete:
        pj.append({"slug": f['slug'], "active": True, "name": f['name'], "sport": "Baseball", "position": f['position'], "gradYear": f['grad_year'],
            "school": f['school'], "team": f.get('team') or "", "location": f.get('location') or "", "coverImage": f['cover'],
            "headline": f['headline'], "playerInstagram": handles, "measurables": meas, "video": {"youtube": "", "file": ""},
            "highlights": [{"title": "Watch the feature on Instagram", "url": post_url}], "report": b or "", "stats": None,
            "academics": [], "links": [], "contactEmail": "", "contactInstagram": "peachstaterecruits", "contactName": "Peach State Recruits",
            "postUrl": post_url, "account": "peachstaterecruits", "showOnHome": True, "videos": []})
sql = """insert into public.players (slug, name, sport, position, grad_year, school, team, location, height, weight, measurables,
  report, cover_url, post_url, ig_account, contact_name, published, show_on_home, posted_at, sample, headline, player_instagram) values
""" + ",\n".join(vals) + """
on conflict (slug) do update set name=excluded.name, sport=excluded.sport, position=excluded.position, grad_year=excluded.grad_year,
  school=excluded.school, team=excluded.team, location=excluded.location, height=excluded.height, weight=excluded.weight,
  measurables=excluded.measurables, report=excluded.report, cover_url=excluded.cover_url, post_url=excluded.post_url,
  ig_account=excluded.ig_account, published=excluded.published, show_on_home=excluded.show_on_home, posted_at=excluded.posted_at,
  sample=false, headline=excluded.headline, player_instagram=excluded.player_instagram
returning slug, published;"""
open('/workspace/ig_import/import.sql', 'w').write(sql)
# players.json: keep samples, replace imported slugs
path = '/workspace/psr_redesign/players.json'
cur = json.load(open(path))
slugs = {f['slug'] for f in F}
cur = [p for p in cur if p['slug'] not in slugs]
json.dump(pj + cur, open(path, 'w'), indent=2, ensure_ascii=False); open(path, 'a').write('\n')
print(f"{len(vals)} rows, {len(pj)} complete/published")
