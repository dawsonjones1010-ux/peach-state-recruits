#!/usr/bin/env python3
"""Helpers for bin/add-player.sh: validate a players-in folder, build players.json
entries, emit Supabase upsert SQL, and manage compressed media.

This module never talks to Supabase over the anon REST API (writes are not
allowed that way). It only reads/writes local files and prints SQL.
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, shutil, subprocess, sys, unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

SITE = "https://dawsonjones1010-ux.github.io/peach-state-recruits"
ET = ZoneInfo("America/New_York")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
CLIP_LIMITS = {"basic": 3, "pro": 8, "elite": None}
VIDEO_EXT = {".mp4", ".m4v", ".mov", ".webm"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}
FORBIDDEN = {
    "phone", "phonenumber", "cell", "mobile", "telephone",
    "address", "homeaddress", "street", "streetaddress", "home", "home_address",
    "homephone", "parentphone", "parent_phone", "parentcell",
    "email", "contactemail", "personalemail", "parentemail", "playeremail",
    "dob", "dateofbirth", "birthday", "ssn", "social",
}
ALIASES = {
    "title": "headline",
    "writeup": "report", "write_up": "report", "writeUp": "report", "approved_writeup": "report",
    "positions": "position",
    "citystate": "location", "city_state": "location", "cityState": "location", "hometown": "location",
    "travelteam": "team", "travel_team": "team", "travelTeam": "team",
    "ighandle": "playerInstagram", "ig_handle": "playerInstagram", "instagram": "playerInstagram",
    "grad_year": "gradYear", "gradyear": "gradYear",
    "packagename": "package", "plan": "package",
    "coach_report": "coachReport", "coachreport": "coachReport",
    "feature_date": "featureDate", "featuredate": "featureDate",
}
REQUIRED = ("name", "gradYear", "position", "height", "weight", "headline", "package", "report")

# ffmpeg preset used by bin/add-player.sh (kept here as documentation + defaults)
FFMPEG_CRF = "23"
FFMPEG_PRESET = "medium"
FFMPEG_AUDIO_BITRATE = "128k"


def repo_root() -> Path:
    return Path(os.environ.get("PSR_ROOT") or Path(__file__).resolve().parents[1])


def players_in_root() -> Path:
    return Path(os.environ.get("PSR_PLAYERS_IN") or repo_root() / "players-in")


def cache_root() -> Path:
    return Path(os.environ.get("PSR_MEDIA_CACHE") or repo_root() / ".media-cache")


def today_et() -> str:
    return datetime.now(ET).date().isoformat()


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def normalize_key(k: str) -> str:
    return re.sub(r"[^a-z0-9]", "", k.lower())


def apply_aliases(raw: dict) -> dict:
    out = {}
    for k, v in raw.items():
        canon = ALIASES.get(k) or ALIASES.get(normalize_key(k)) or k
        if canon not in out:
            out[canon] = v
    return out


def normalize_package(v) -> str:
    s = str(v or "").strip().lower()
    s = re.sub(r"[^a-z]", "", s)
    if s in CLIP_LIMITS:
        return s
    return str(v or "").strip().lower()


def normalize_height(v) -> str:
    s = unicodedata.normalize("NFKC", str(v or "")).strip()
    s = s.replace("’", "'").replace("′", "'").replace("″", '"').replace("”", '"')
    m = re.match(r"^(\d+)\s*[\'\-]\s*(\d+)\s*\"?$", s)
    if m:
        return f"{int(m.group(1))}'{int(m.group(2))}\""
    m = re.match(r"^(\d+)\s*ft\.?\s*(\d+)\s*in\.?$", s, re.I)
    if m:
        return f"{int(m.group(1))}'{int(m.group(2))}\""
    return s


def normalize_weight(v) -> str:
    s = unicodedata.normalize("NFKC", str(v or "")).strip().lower()
    m = re.match(r"^(\d+)\s*(lbs?|pounds?)?$", s)
    if m:
        return f"{int(m.group(1))} lb"
    return str(v or "").strip()


def normalize_handles(v) -> list:
    if v is None or v == "":
        return []
    if isinstance(v, str):
        parts = [p.strip() for p in re.split(r"[,\s]+", v) if p.strip()]
    elif isinstance(v, (list, tuple)):
        parts = [str(p).strip() for p in v if str(p).strip()]
    else:
        parts = [str(v).strip()]
    out = []
    for p in parts:
        p = p.lstrip("@")
        p = re.sub(r"^https?://(www\.)?instagram\.com/", "", p).strip("/")
        if p and p not in out:
            out.append(p)
    return out


def clip_limit(package: str):
    return CLIP_LIMITS.get(normalize_package(package))


def find_cover(folder: Path) -> Path | None:
    exact = []
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.stem.lower() == "cover" and p.suffix.lower() in IMAGE_EXT:
            exact.append(p)
    if exact:
        order = {".jpg": 0, ".jpeg": 1, ".png": 2, ".webp": 3}
        exact.sort(key=lambda p: (order.get(p.suffix.lower(), 9), p.name))
        return exact[0]
    return None


def find_clips(folder: Path) -> list[Path]:
    clips_dir = folder / "clips"
    if clips_dir.is_dir():
        files = [p for p in clips_dir.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXT]
    else:
        files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXT]
    files.sort(key=lambda p: p.name.lower())
    return files


def load_input(slug: str, root: Path | None = None) -> dict:
    folder = (root or players_in_root()) / slug
    meta_path = folder / "player.json"
    raw = {}
    if meta_path.is_file():
        raw = json.loads(meta_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raw = {}
    meta = apply_aliases(raw)
    if "package" in meta:
        meta["package"] = normalize_package(meta["package"])
    if "height" in meta:
        meta["height"] = normalize_height(meta["height"])
    if "weight" in meta:
        meta["weight"] = normalize_weight(meta["weight"])
    if "playerInstagram" in meta:
        meta["playerInstagram"] = normalize_handles(meta["playerInstagram"])
    if "gradYear" in meta and meta["gradYear"] not in (None, ""):
        try:
            meta["gradYear"] = int(str(meta["gradYear"]).strip())
        except ValueError:
            pass
    if isinstance(meta.get("report"), str):
        # Drop a trailing campaign hashtag; do not otherwise rewrite the write-up.
        meta["report"] = re.sub(r"\n*#peachstaterecruits\s*$", "", meta["report"].strip())
    return {
        "slug": slug,
        "folder": folder,
        "meta": meta,
        "raw": raw,
        "cover": find_cover(folder) if folder.is_dir() else None,
        "clips": find_clips(folder) if folder.is_dir() else [],
        "meta_path": meta_path,
    }


def forbidden_fields(raw: dict) -> list[str]:
    hits = []
    for k, v in raw.items():
        nk = normalize_key(k)
        if nk in FORBIDDEN and v not in (None, "", [], {}):
            hits.append(k)
    return hits


def validate_one(slug: str, root: Path | None = None) -> list[str]:
    problems = []
    if not SLUG_RE.fullmatch(slug or ""):
        problems.append(f"{slug or '(empty)'}: slug must be lowercase letters, numbers and dashes")
    src = load_input(slug, root)
    folder, meta, raw = src["folder"], src["meta"], src["raw"]
    if not folder.is_dir():
        problems.append(f"{slug}: missing input folder {folder}")
        return problems
    if not src["meta_path"].is_file():
        problems.append(f"{slug}: missing player.json")
    for key in REQUIRED:
        val = meta.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            problems.append(f"{slug}: missing required field '{key}'")
    if not any(str(meta.get(k) or "").strip() for k in ("school", "team", "location")):
        problems.append(f"{slug}: need at least one of school, team, or location")
    pkg = meta.get("package")
    if pkg and pkg not in CLIP_LIMITS:
        problems.append(f"{slug}: package must be basic, pro, or elite (got {raw.get('package')!r})")
    gy = meta.get("gradYear")
    if gy is not None and not isinstance(gy, int):
        problems.append(f"{slug}: gradYear must be a 4-digit year (got {gy!r})")
    elif isinstance(gy, int) and not (2020 <= gy <= 2040):
        problems.append(f"{slug}: gradYear {gy} looks out of range")
    for k in forbidden_fields(raw):
        problems.append(f"{slug}: personal contact field '{k}' is not allowed on a public profile (minors: scouting info only)")
    if src["cover"] is None:
        problems.append(f"{slug}: missing cover image (expected cover.jpg or cover.png)")
    limit = clip_limit(pkg) if pkg in CLIP_LIMITS else None
    n = len(src["clips"])
    if limit is not None and n > limit:
        problems.append(f"{slug}: {pkg} allows at most {limit} clip(s); found {n}")
    return problems


def validate_slugs(slugs: list[str], root: Path | None = None) -> list[str]:
    problems = []
    seen = set()
    if not slugs:
        problems.append("no slug given")
    for slug in slugs:
        if slug in seen:
            problems.append(f"{slug}: listed more than once")
            continue
        seen.add(slug)
        problems.extend(validate_one(slug, root))
    return problems


def default_coach_report(meta: dict) -> str:
    """Factual profile line from structured fields only. No invented scouting language."""
    gy = meta.get("gradYear")
    pos = meta.get("position") or ""
    loc = meta.get("location") or ""
    bits = []
    if gy and pos:
        bits.append(f"{gy} {pos} from {loc}.".replace("  ", " ").replace(" from .", "."))
    elif gy:
        bits.append(f"{gy} prospect" + (f" from {loc}." if loc else "."))
    school = meta.get("school") or ""
    team = meta.get("team") or ""
    mid = "; ".join(x for x in (school, team) if x)
    meas = ", ".join(x for x in (meta.get("height"), meta.get("weight")) if x)
    parts = [f"Profile: {bits[0]}" if bits else "Profile:"]
    if mid:
        parts[0] = parts[0].rstrip(".") + (". " if bits else " ") + mid + "."
    if meas:
        parts[0] = parts[0].rstrip(".") + f". {meas}."
    parts[0] = re.sub(r"\s+", " ", parts[0]).replace("..", ".").strip()
    return parts[0]


def build_entry(slug: str, src: dict | None = None, site: str = SITE) -> dict:
    src = src or load_input(slug)
    meta = src["meta"]
    height = normalize_height(meta.get("height"))
    weight = normalize_weight(meta.get("weight"))
    position = str(meta.get("position") or "").strip()
    n = len(src["clips"])
    videos = [{
        "kind": "file",
        "url": f"{site}/videos/{slug}/clip{i}.mp4",
        "title": f"Highlight clip {i}",
    } for i in range(1, n + 1)]
    existing_coach = (meta.get("coachReport") or "").strip()
    return {
        "slug": slug,
        "active": True,
        "name": str(meta["name"]).strip(),
        "sport": "Baseball",
        "position": position,
        "gradYear": meta["gradYear"],
        "school": str(meta.get("school") or "").strip(),
        "team": str(meta.get("team") or "").strip(),
        "location": str(meta.get("location") or "").strip(),
        "coverImage": f"images/players/{slug}.jpg",
        "headline": str(meta["headline"]).strip(),
        "playerInstagram": list(meta.get("playerInstagram") or []),
        "measurables": [
            {"label": "Height", "value": height},
            {"label": "Weight", "value": weight},
            {"label": "Position", "value": position},
        ],
        "video": {"youtube": "", "file": ""},
        "highlights": [],
        "report": str(meta.get("report") or "").strip(),
        "stats": None,
        "academics": [],
        "links": [],
        "contactEmail": "",
        "contactInstagram": "peachstaterecruits",
        "contactName": "Peach State Recruits",
        "postUrl": "",
        "account": "peachstaterecruits",
        "showOnHome": True,
        "videos": videos,
        "coachReport": existing_coach or default_coach_report(meta),
        "featuredRank": None,
        "featureDate": str(meta.get("featureDate") or today_et()),
    }


PRESERVE_ON_UPDATE = (
    "postUrl", "featuredRank", "highlights", "links", "academics", "stats",
    "contactName", "account", "showOnHome", "active", "video",
)


def upsert_players_json(entries: list[dict], path: Path | None = None) -> list[dict]:
    """Insert or update by slug, moving updated rows to the front. No duplicates."""
    path = path or (repo_root() / "players.json")
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    if not isinstance(data, list):
        raise ValueError("players.json must be a list")
    by_slug = {p.get("slug"): p for p in data if p.get("slug")}
    incoming = {e["slug"] for e in entries}
    merged_new = []
    for e in entries:
        old = by_slug.get(e["slug"])
        if old:
            kept = dict(e)
            for k in PRESERVE_ON_UPDATE:
                if k in old and (not kept.get(k) and old.get(k) not in (None, "", [], {})):
                    # Do not clobber a real Instagram post or featured rank with a blank default
                    if k in ("postUrl", "featuredRank", "highlights", "links", "academics", "stats") and old.get(k):
                        kept[k] = old[k]
                    elif k in ("showOnHome", "active") and "showOnHome" not in e:
                        kept[k] = old[k]
            # Always take the new cover, report, videos, measurables, headline from the entry
            merged_new.append(kept)
        else:
            merged_new.append(e)
    rest = [p for p in data if p.get("slug") not in incoming]
    out = merged_new + rest
    # Guarantee uniqueness
    seen = set()
    unique = []
    for p in out:
        s = p.get("slug")
        if not s or s in seen:
            continue
        seen.add(s)
        unique.append(p)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(unique, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return unique


def share_slugs(players: list[dict], preferred: list[str], n: int = 3) -> list[str]:
    """Newest preferred slugs first, then other home-page players with covers."""
    out = []
    for s in preferred:
        if s not in out:
            out.append(s)
    for p in players:
        s = p.get("slug")
        if not s or s in out:
            continue
        if p.get("active") is False:
            continue
        if not (p.get("coverImage") or p.get("showOnHome", True)):
            continue
        if p.get("showOnHome") is False:
            continue
        out.append(s)
        if len(out) >= n:
            break
    return out[:n]


def dollar(s: str, tag: str = "psr") -> str:
    s = "" if s is None else str(s)
    while f"${tag}$" in s:
        tag += "x"
    return f"${tag}${s}${tag}$"


def emit_sql(entries: list[dict], site: str = SITE) -> str:
    """Idempotent upsert SQL keyed on slug. No anon-key REST writes."""
    chunks = ["BEGIN;"]
    for e in entries:
        slug = e["slug"]
        meas = json.dumps(e.get("measurables") or [], ensure_ascii=False)
        ig = e.get("playerInstagram") or []
        if ig:
            ig_sql = "ARRAY[" + ", ".join(dollar(h) + "::text" for h in ig) + "]"
        else:
            ig_sql = "'{}'::text[]"
        height = next((m["value"] for m in e.get("measurables") or [] if m.get("label") == "Height"), "")
        weight = next((m["value"] for m in e.get("measurables") or [] if m.get("label") == "Weight"), "")
        cover = f"{site}/images/players/{slug}.jpg"
        chunks.append(f"""
-- {e['name']} ({slug})
UPDATE public.players SET
  name = {dollar(e['name'])},
  sport = 'Baseball',
  position = {dollar(e['position'])},
  grad_year = {int(e['gradYear'])},
  school = {dollar(e.get('school') or '')},
  team = {dollar(e.get('team') or '')},
  location = {dollar(e.get('location') or '')},
  height = {dollar(height)},
  weight = {dollar(weight)},
  measurables = {dollar(meas)}::jsonb,
  report = {dollar(e.get('report') or '')},
  cover_url = {dollar(cover)},
  ig_account = 'peachstaterecruits',
  contact_email = NULL,
  contact_name = 'Peach State Recruits',
  published = TRUE,
  show_on_home = TRUE,
  sample = FALSE,
  headline = {dollar(e.get('headline') or '')},
  player_instagram = {ig_sql},
  coach_report = {dollar(e.get('coachReport') or '')},
  feature_date = {dollar(e.get('featureDate') or today_et())}::date,
  updated_at = NOW()
WHERE slug = {dollar(slug)};

INSERT INTO public.players (
  slug, name, sport, position, grad_year, school, team, location,
  height, weight, measurables, stats, academics, links, report,
  cover_url, ig_account, contact_email, contact_name,
  published, show_on_home, sample, headline, player_instagram,
  coach_report, featured_rank, feature_date, posted_at
)
SELECT
  {dollar(slug)}, {dollar(e['name'])}, 'Baseball', {dollar(e['position'])},
  {int(e['gradYear'])}, {dollar(e.get('school') or '')}, {dollar(e.get('team') or '')},
  {dollar(e.get('location') or '')}, {dollar(height)}, {dollar(weight)},
  {dollar(meas)}::jsonb, NULL, '[]'::jsonb, '[]'::jsonb,
  {dollar(e.get('report') or '')}, {dollar(cover)},
  'peachstaterecruits', NULL, 'Peach State Recruits',
  TRUE, TRUE, FALSE, {dollar(e.get('headline') or '')}, {ig_sql},
  {dollar(e.get('coachReport') or '')}, NULL,
  {dollar(e.get('featureDate') or today_et())}::date, NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.players WHERE slug = {dollar(slug)});

DELETE FROM public.player_videos
WHERE player_id = (SELECT id FROM public.players WHERE slug = {dollar(slug)})
  AND kind = 'file';
""")
        videos = e.get("videos") or []
        if videos:
            values = []
            # Clip 1 gets the newest created_at (site sorts by created_at desc).
            for i, v in enumerate(videos):
                ago = i
                values.append(
                    f"((SELECT id FROM public.players WHERE slug = {dollar(slug)}), "
                    f"{dollar(v.get('kind') or 'file')}, {dollar(v['url'])}, "
                    f"{dollar(v.get('title') or f'Highlight clip {i+1}')}, "
                    f"NOW() - interval '{ago} seconds')"
                )
            chunks.append(
                "INSERT INTO public.player_videos (player_id, kind, url, title, created_at)\nVALUES\n  "
                + ",\n  ".join(values) + ";\n"
            )
    chunks.append("COMMIT;")
    return "\n".join(chunks).strip() + "\n"


def cache_path_for(source: Path, suffix: str) -> Path:
    digest = sha256_file(source)
    return cache_root() / "v1" / f"{digest}{suffix}"


def prepare_media_jobs(slugs: list[str], in_root: Path | None = None) -> dict:
    """Build an ffmpeg job list and cover tasks. Cached hashes are skipped."""
    jobs = []
    covers = []
    clips = []
    cache_root().mkdir(parents=True, exist_ok=True)
    (cache_root() / "v1").mkdir(parents=True, exist_ok=True)
    for slug in slugs:
        src = load_input(slug, in_root)
        if src["cover"]:
            dest_cache = cache_path_for(src["cover"], ".jpg")
            covers.append({
                "slug": slug,
                "source": str(src["cover"]),
                "cache": str(dest_cache),
                "skip": dest_cache.is_file() and dest_cache.stat().st_size > 0,
                "dest_rel": f"images/players/{slug}.jpg",
            })
        for i, clip in enumerate(src["clips"], 1):
            dest_cache = cache_path_for(clip, ".mp4")
            item = {
                "slug": slug,
                "index": i,
                "source": str(clip),
                "cache": str(dest_cache),
                "skip": dest_cache.is_file() and dest_cache.stat().st_size > 0,
                "dest_rel": f"videos/{slug}/clip{i}.mp4",
            }
            clips.append(item)
            if not item["skip"]:
                jobs.append({"in": str(clip), "out": str(dest_cache)})
    return {"jobs": jobs, "covers": covers, "clips": clips}


def convert_cover(source: Path, dest: Path, quality: int = 86) -> None:
    from PIL import Image
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.jpg")
    im = Image.open(source).convert("RGB")
    im.save(tmp, quality=quality, optimize=True, progressive=True)
    tmp.replace(dest)


def keep_smaller(source: Path, encoded: Path) -> str:
    """If the re-encode is larger, keep a faststart remux (or copy) of the source."""
    if not encoded.exists():
        raise FileNotFoundError(encoded)
    if encoded.stat().st_size <= source.stat().st_size:
        return "encoded"
    remux = encoded.with_suffix(".remux.mp4")
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(source), "-c", "copy", "-movflags", "+faststart", str(remux),
    ]
    try:
        subprocess.run(cmd, check=True)
        use = remux if remux.exists() and remux.stat().st_size <= encoded.stat().st_size else None
    except subprocess.CalledProcessError:
        use = None
    if use is None:
        # Fall back to the original bytes
        shutil.copy2(source, encoded)
        if remux.exists():
            remux.unlink()
        return "original"
    remux.replace(encoded)
    return "original-faststart"


def install_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() or dest.is_symlink():
        dest.unlink()
    shutil.copy2(src, dest)


def install_media(manifest: dict, dest_root: Path) -> list[str]:
    notes = []
    for item in manifest.get("covers", []):
        cache = Path(item["cache"])
        if not cache.is_file():
            raise SystemExit(f"missing compressed cover in cache: {cache}")
        install_file(cache, dest_root / item["dest_rel"])
        notes.append(item["dest_rel"])
    for item in manifest.get("clips", []):
        cache = Path(item["cache"])
        if not cache.is_file():
            raise SystemExit(f"missing compressed clip in cache: {cache}")
        install_file(cache, dest_root / item["dest_rel"])
        notes.append(item["dest_rel"])
    return notes


def write_jobs_file(jobs: list[dict], path: Path) -> int:
    lines = []
    for j in jobs:
        if "\t" in j["in"] or "\t" in j["out"]:
            raise SystemExit(f"refusing a path with a tab: {j}")
        lines.append(f"{j['in']}\t{j['out']}")
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    return len(lines)


def cmd_gate(args) -> int:
    problems = validate_slugs(args.slugs, Path(args.players_in) if args.players_in else None)
    if problems:
        print("Publish gate failed:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print("Gate OK:", ", ".join(args.slugs))
    for slug in args.slugs:
        src = load_input(slug, Path(args.players_in) if args.players_in else None)
        limit = clip_limit(src["meta"]["package"])
        limit_s = "unlimited" if limit is None else str(limit)
        print(f"  {slug}: {src['meta']['package']} ({len(src['clips'])} clip(s), max {limit_s}); cover {src['cover'].name}")
    return 0


def cmd_prepare_media(args) -> int:
    in_root = Path(args.players_in) if args.players_in else None
    manifest = prepare_media_jobs(args.slugs, in_root)
    write_jobs_file(manifest["jobs"], Path(args.jobs_file))
    Path(args.manifest).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    skipped = sum(1 for c in manifest["clips"] if c["skip"]) + sum(1 for c in manifest["covers"] if c["skip"])
    print(f"media jobs: {len(manifest['jobs'])} ffmpeg, {skipped} cache hit(s)", file=sys.stderr)
    return 0


def cmd_covers(args) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    for item in manifest.get("covers", []):
        if item.get("skip") and Path(item["cache"]).is_file():
            continue
        convert_cover(Path(item["source"]), Path(item["cache"]))
        item["skip"] = True
    Path(args.manifest).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


def cmd_keep_smaller(args) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    for item in manifest.get("clips", []):
        cache = Path(item["cache"])
        src = Path(item["source"])
        if not cache.is_file():
            print(f"missing encode: {cache}", file=sys.stderr)
            return 1
        if item.get("skip"):
            continue
        item["kept"] = keep_smaller(src, cache)
    Path(args.manifest).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 0


def cmd_install_media(args) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    notes = install_media(manifest, Path(args.dest_root))
    for n in notes:
        print(n)
    return 0


def cmd_upsert_json(args) -> int:
    in_root = Path(args.players_in) if args.players_in else None
    dest = Path(args.players_json)
    entries = [build_entry(s, load_input(s, in_root)) for s in args.slugs]
    players = upsert_players_json(entries, dest)
    print(f"players.json: {len(players)} players; front: {', '.join(p['slug'] for p in players[:5])}")
    leads = share_slugs(players, args.slugs)
    print("SHARE_SLUGS=" + " ".join(leads))
    return 0


def cmd_emit_sql(args) -> int:
    in_root = Path(args.players_in) if args.players_in else None
    entries = [build_entry(s, load_input(s, in_root)) for s in args.slugs]
    sql = emit_sql(entries)
    Path(args.out).write_text(sql, encoding="utf-8")
    print(args.out)
    return 0


def cmd_build_entry(args) -> int:
    in_root = Path(args.players_in) if args.players_in else None
    entry = build_entry(args.slugs[0], load_input(args.slugs[0], in_root))
    json.dump(entry, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


def add_slug_args(p):
    p.add_argument("slugs", nargs="+")
    p.add_argument("--players-in", default=None)
    return p


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    add_slug_args(sub.add_parser("gate", help="Validate input folders and package clip limits"))
    p = add_slug_args(sub.add_parser("prepare-media"))
    p.add_argument("--jobs-file", required=True)
    p.add_argument("--manifest", required=True)
    p = sub.add_parser("covers")
    p.add_argument("--manifest", required=True)
    p = sub.add_parser("keep-smaller")
    p.add_argument("--manifest", required=True)
    p = sub.add_parser("install-media")
    p.add_argument("--manifest", required=True)
    p.add_argument("--dest-root", required=True)
    p = add_slug_args(sub.add_parser("upsert-json"))
    p.add_argument("--players-json", required=True)
    p = add_slug_args(sub.add_parser("emit-sql"))
    p.add_argument("--out", required=True)
    add_slug_args(sub.add_parser("build-entry"))
    args = ap.parse_args(argv)
    fn = {
        "gate": cmd_gate,
        "prepare-media": cmd_prepare_media,
        "covers": cmd_covers,
        "keep-smaller": cmd_keep_smaller,
        "install-media": cmd_install_media,
        "upsert-json": cmd_upsert_json,
        "emit-sql": cmd_emit_sql,
        "build-entry": cmd_build_entry,
    }[args.cmd]
    return fn(args)


if __name__ == "__main__":
    sys.exit(main())
