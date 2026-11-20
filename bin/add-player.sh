#!/usr/bin/env bash
# Publish one or more owner-approved player features to the Peach State Recruits site.
# Usage: bin/add-player.sh [--dry-run] [--resume-after-sql] <slug> [<slug>...]
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bin/add-player.sh [--dry-run] [--resume-after-sql] <slug> [<slug>...]

Publish owner-approved player features from players-in/<slug>/.

  --dry-run            Validate, compress (to cache), build a staging site, emit
                       SQL, and run the targeted Playwright check. Does not write
                       to the repo, Supabase, git, or the live site.
  --resume-after-sql   After you have applied the emitted SQL via the Supabase MCP
                       (or psql), commit, push, and wait for the live profile.

If PSR_SUPABASE_DB_URL or DATABASE_URL is set, the script applies the SQL itself
with psql. The anon REST key is never used for writes.

Full test suites (npm test, test:dom, etc.) are not run here. Run them only when
templates, CSS or JS change — see docs/PUBLISH_PLAYER.md.
USAGE
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PSR_ROOT="${PSR_ROOT:-$ROOT}"

DRY=0
RESUME=0
SLUGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --dry-run) DRY=1; shift ;;
    --resume-after-sql) RESUME=1; shift ;;
    --) shift; SLUGS+=("$@"); break ;;
    -*)
      echo "Unknown flag: $1" >&2
      usage >&2
      exit 2
      ;;
    *) SLUGS+=("$1"); shift ;;
  esac
done

if [[ ${#SLUGS[@]} -eq 0 ]]; then
  usage >&2
  exit 2
fi

PY="$ROOT/tools/publish_player.py"
PLAYERS_IN="${PSR_PLAYERS_IN:-$ROOT/players-in}"
CACHE="${PSR_MEDIA_CACHE:-$ROOT/.media-cache}"
STAGING="${PSR_STAGING:-$ROOT/.publish-staging}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/psr-publish.XXXXXX")"
STARTED_SERVER_PID=""
STEP_NAMES=()
STEP_SECS=()

cleanup() {
  local st=$?
  if [[ -n "${STARTED_SERVER_PID}" ]] && kill -0 "$STARTED_SERVER_PID" 2>/dev/null; then
    kill "$STARTED_SERVER_PID" 2>/dev/null || true
    wait "$STARTED_SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
  exit "$st"
}
trap cleanup EXIT

log() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

step() {
  local name="$1"; shift
  log ""
  log "==> $name"
  local start end secs
  start="$(date +%s%N)"
  "$@"
  end="$(date +%s%N)"
  secs="$(python3 -c "print(f'{($end - $start) / 1e9:.2f}')")"
  log "  [$name] ${secs}s"
  STEP_NAMES+=("$name")
  STEP_SECS+=("$secs")
}

print_summary() {
  log ""
  log "========== timings =========="
  local i total=0
  for i in "${!STEP_NAMES[@]}"; do
    printf '  %-22s %8ss\n' "${STEP_NAMES[$i]}" "${STEP_SECS[$i]}"
    total="$(python3 -c "print(f'{float('$total') + float('${STEP_SECS[$i]}'):.2f}')")"
  done
  printf '  %-22s %8ss\n' "TOTAL" "$total"
  log "============================="
}

do_commit_push() {
  [[ $DRY -eq 1 ]] && { log "dry-run: skip commit and push"; return 0; }
  local paths=() slug
  paths+=(players.json sitemap.xml images/share.jpg)
  for slug in "${SLUGS[@]}"; do
    paths+=(
      "images/players/${slug}.jpg"
      "images/players/${slug}-640.jpg"
      "images/og/${slug}.jpg"
      "player/${slug}/"
      "videos/${slug}/"
    )
  done
  git add -- "${paths[@]}"
  if git diff --cached --quiet; then
    log "nothing new to commit (working tree already matches)"
  else
    local names
    names="$(python3 -c "import json,sys; d=json.load(open('players.json')); s=set(sys.argv[1:]); print(', '.join(p['name'] for p in d if p.get('slug') in s))" "${SLUGS[@]}")"
    if [[ ${#SLUGS[@]} -eq 1 ]]; then
      git commit -m "Add public profile for ${names} with cover and highlight clips"
    else
      git commit -m "Add public profiles for ${names} with covers and highlight clips"
    fi
  fi
  git push origin HEAD
}

do_live_check() {
  [[ $DRY -eq 1 ]] && { log "dry-run: skip live check"; return 0; }
  local site="https://dawsonjones1010-ux.github.io/peach-state-recruits"
  python3 - "$site" "${SLUGS[@]}" <<'LIVECHECK'
import re, sys, time, urllib.request
site = sys.argv[1].rstrip("/")
slugs = sys.argv[2:]
timeout = 180
interval = 10
start = time.time()
pending = list(slugs)
while pending:
    elapsed = time.time() - start
    if elapsed > timeout:
        print(f"LIVE CHECK FAILED after {elapsed:.0f}s; still waiting on: {', '.join(pending)}", file=sys.stderr)
        sys.exit(1)
    still = []
    for slug in pending:
        url = f"{site}/player/{slug}/"
        try:
            req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8", "replace")
                status = r.status
        except Exception as e:
            print(f"  {slug}: not ready ({e})")
            still.append(slug)
            continue
        m = re.search(r"<title>(.*?)</title>", body, re.S)
        title = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        first = slug.split("-")[0]
        if status == 200 and first.lower() in title.lower():
            print(f"  {slug}: 200 and title {title!r} after {elapsed:.0f}s")
        else:
            still.append(slug)
            print(f"  {slug}: HTTP {status} title={title!r}")
    pending = still
    if pending:
        time.sleep(interval)
print(f"live check passed in {time.time()-start:.0f}s")
LIVECHECK
}

if [[ $RESUME -eq 1 ]]; then
  if [[ $DRY -eq 1 ]]; then
    fail_msg="--resume-after-sql cannot be combined with --dry-run"
    printf 'ERROR: %s\n' "$fail_msg" >&2
    exit 1
  fi
  step commit_push do_commit_push
  step live_check do_live_check
  print_summary
  exit 0
fi

do_gate() {
  python3 "$PY" gate --players-in "$PLAYERS_IN" "${SLUGS[@]}"
}

FFMPEG_ONE() {
  local in="$1" out="$2"
  mkdir -p "$(dirname "$out")"
  ffmpeg -y -hide_banner -loglevel error -i "$in" \
    -map 0:v:0 -map 0:a? \
    -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 \
    -crf 23 -preset medium \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "$out"
}

do_compress() {
  mkdir -p "$CACHE/v1"
  python3 "$PY" prepare-media --players-in "$PLAYERS_IN" \
    --jobs-file "$WORK/ffmpeg-jobs.tsv" --manifest "$WORK/media.json" "${SLUGS[@]}"
  python3 "$PY" covers --manifest "$WORK/media.json"
  if [[ -s "$WORK/ffmpeg-jobs.tsv" ]]; then
    export -f FFMPEG_ONE
    cut -f1,2 "$WORK/ffmpeg-jobs.tsv" | xargs -P4 -n2 bash -c 'FFMPEG_ONE "$0" "$1"'
  else
    log "all clips already in the media cache"
  fi
  python3 "$PY" keep-smaller --manifest "$WORK/media.json"
}

prepare_dest() {
  if [[ $DRY -eq 1 ]]; then
    log "dry-run: building a hardlinked staging tree at $STAGING (repo files stay untouched)"
    rm -rf "$STAGING"
    mkdir -p "$STAGING"
    local f d
    for f in index.html players.html player.html find-my-level.html email-coach.html \
             colleges.html camps.html my-recruiting.html admin.html admin-recruiting.html \
             account.html 404.html styles.css config.js shared.js portal.js players.json \
             robots.txt sitemap.xml favicon.png favicon-16.png favicon.ico; do
      [[ -e "$ROOT/$f" ]] && cp -a "$ROOT/$f" "$STAGING/$f"
    done
    # Copy trees that the builders may overwrite. Hardlink only videos/ (large
    # and only added to). Never hardlink player/: build_stubs.py deletes and
    # rebuilds that folder, which would also delete the repo if it shared inodes.
    for d in images vendor data estimator recruiting; do
      if [[ -d "$ROOT/$d" ]]; then
        cp -a "$ROOT/$d" "$STAGING/$d"
      fi
    done
    if [[ -d "$ROOT/videos" ]]; then
      cp -al "$ROOT/videos" "$STAGING/videos"
    fi
    ln -sfn "$ROOT/tools" "$STAGING/tools"
    DEST="$STAGING"
  else
    DEST="$ROOT"
  fi
}

do_render() {
  prepare_dest
  python3 "$PY" install-media --manifest "$WORK/media.json" --dest-root "$DEST"
  python3 "$PY" upsert-json --players-in "$PLAYERS_IN" --players-json "$DEST/players.json" "${SLUGS[@]}" \
    | tee "$WORK/upsert-json.out"
  local share
  share="$(grep '^SHARE_SLUGS=' "$WORK/upsert-json.out" | tail -n1 | sed 's/^SHARE_SLUGS=//')"
  (
    cd "$DEST"
    PSR_ROOT="$DEST" python3 "$ROOT/tools/build_stubs.py" --root "$DEST" --from-json
    # shellcheck disable=SC2086
    PSR_ROOT="$DEST" python3 "$ROOT/tools/build_share.py" $share
  )
}

SQL_FILE=""
do_sql() {
  mkdir -p "$CACHE"
  SQL_FILE="${PSR_SQL_OUT:-$CACHE/upsert-${SLUGS[*]}.sql}"
  SQL_FILE="${SQL_FILE// /+}"
  python3 "$PY" emit-sql --players-in "$PLAYERS_IN" --out "$SQL_FILE" "${SLUGS[@]}"
  log "SQL written to $SQL_FILE"
  if [[ $DRY -eq 1 ]]; then
    log "dry-run: SQL was not applied"
    return 0
  fi
  local db="${PSR_SUPABASE_DB_URL:-${DATABASE_URL:-}}"
  if [[ -n "$db" ]]; then
    if ! command -v psql >/dev/null 2>&1; then
      printf 'ERROR: PSR_SUPABASE_DB_URL is set but psql is not installed\n' >&2
      exit 1
    fi
    psql "$db" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
    log "applied SQL via psql"
    return 0
  fi
  log "No PSR_SUPABASE_DB_URL / DATABASE_URL in the environment."
  log "Apply $SQL_FILE with the Supabase MCP execute_sql tool (never the anon REST key),"
  log "then run: bin/add-player.sh --resume-after-sql ${SLUGS[*]}"
}

free_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'
}

do_test() {
  local dest="$DEST"
  local port url
  if [[ $DRY -eq 0 && -z "${PSR_TEST_BASE:-}" ]] && curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:8811/players.json"; then
    url="http://127.0.0.1:8811/"
    log "using existing local server $url"
  else
    port="$(free_port)"
    python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dest" >/dev/null 2>&1 &
    STARTED_SERVER_PID=$!
    url="http://127.0.0.1:${port}/"
    python3 - "$url" <<'WAITSRV'
import sys, time, urllib.request
url = sys.argv[1]
for _ in range(40):
    try:
        urllib.request.urlopen(url, timeout=1)
        break
    except Exception:
        time.sleep(0.1)
else:
    raise SystemExit(f"local server did not start: {url}")
WAITSRV
    log "started local server $url (pid $STARTED_SERVER_PID)"
  fi
  node "$ROOT/tools/publish_player_check.js" "$url" "${SLUGS[@]}"
  if [[ -n "$STARTED_SERVER_PID" ]]; then
    kill "$STARTED_SERVER_PID" 2>/dev/null || true
    wait "$STARTED_SERVER_PID" 2>/dev/null || true
    STARTED_SERVER_PID=""
  fi
}

do_maybe_push() {
  if [[ $DRY -eq 1 ]]; then
    log "dry-run: skip commit, push and live check"
    return 0
  fi
  local db="${PSR_SUPABASE_DB_URL:-${DATABASE_URL:-}}"
  if [[ -z "$db" ]]; then
    log "Skipping push because Supabase SQL has not been applied in this run."
    log "Apply $SQL_FILE via the Supabase MCP, then:"
    log "  bin/add-player.sh --resume-after-sql ${SLUGS[*]}"
    return 0
  fi
  do_commit_push
  do_live_check
}

step gate do_gate
step compress do_compress
step render do_render
step supabase_sql do_sql
step targeted_test do_test
if [[ $DRY -eq 0 ]]; then
  step commit_push_or_hold do_maybe_push
fi
print_summary

if [[ $DRY -eq 1 ]]; then
  log "Dry-run finished. Staging site: $STAGING"
  log "Repo working tree was not modified (media written only to $CACHE and $STAGING)."
fi
