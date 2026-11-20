# Publish a player profile

One-command pipeline for an owner-approved Peach State Recruits feature. Use this instead of hand-editing `players.json` and copying pages.

**Do not run this for a player the owner has not approved.** Public pages carry scouting info only: no home address, phone, or personal contact. Do not invent stats, offers, or college odds, and do not AI-edit the athlete's cover or clips.

## Input

Create `players-in/<slug>/` (the folder is gitignored and is not in the GitHub Pages allowlist):

```
players-in/colin-lopez/
  player.json
  cover.png          # or cover.jpg
  clips/
    clip1.mp4
    clip2.mp4
    clip3.mp4
```

`slug` is lowercase with dashes and becomes `/player/<slug>/`.

### `player.json`

```json
{
  "name": "Colin Lopez",
  "gradYear": 2030,
  "position": "C/3B",
  "height": "5'6\"",
  "weight": "150 lb",
  "school": "Lemont High School",
  "location": "Lemont, Illinois",
  "team": "Bolingbrook Rampage",
  "title": "COLIN LOPEZ IS A STUD📈",
  "package": "basic",
  "report": "The owner-approved write-up, used as given. Do not rewrite it.",
  "igHandle": "",
  "coachReport": ""
}
```

Aliases accepted: `title` / `headline`, `writeup` / `report`, `positions` / `position`, `travelTeam` / `team`, `cityState` / `location`, `igHandle` / `playerInstagram`.

- **package** controls the clip cap only and is not shown on the site: Basic = 3, Pro = 8, Elite = unlimited.
- **report** is the approved write-up. The pipeline does not edit it (a trailing `#peachstaterecruits` is stripped).
- **coachReport** is optional. If omitted, a one-line Profile entry is built from the structured fields only (name, year, position, school, team, location, height, weight). No scouting language is invented.
- Height / weight are normalized to `5'6"` and `150 lb`.
- Filled `phone`, `address`, `email`, or `contactEmail` fields fail the gate.

## Command

From the repo root:

```bash
bin/add-player.sh --dry-run colin-lopez          # no repo writes, no Supabase, no push
bin/add-player.sh colin-lopez                    # or several slugs at once
bin/add-player.sh --resume-after-sql colin-lopez # after applying the emitted SQL
```

`$PSR_PLAYERS_IN` overrides the input folder (default `players-in/`).

### Steps (and timings)

The script prints seconds for each step:

1. **gate** — required files and fields, package clip limit, no personal contact. Fails fast and lists every problem.
2. **compress** — up to 4 `ffmpeg` jobs in parallel (`xargs -P4`), one fixed preset (H.264 High, yuv420p, CRF 23, medium, AAC 128k, `+faststart`). If the re-encode is larger, the original is kept (remuxed for faststart when needed). Covers become the same JPEG / 640 / OG outputs `tools/build_stubs.py` already produces (quality 86 / 80 / 84). A `.media-cache/` hash index skips work that has already been done. Cache and `players-in/` are gitignored.
3. **render** — installs media, upserts `players.json` by slug (reruns do not duplicate rows; the new players are moved to the front), then runs `python3 tools/build_stubs.py --from-json` and `python3 tools/build_share.py` so pages, `sitemap.xml`, 640px covers, OG cards, and `images/share.jpg` stay consistent with the existing builders. Pages are never hand-copied.
4. **supabase_sql** — writes idempotent `UPDATE` / `INSERT` / video-replace SQL keyed on `slug`. The anon REST key is never used for writes. If `PSR_SUPABASE_DB_URL` or `DATABASE_URL` is set, the script applies it with `psql`. Otherwise it prints the file and the agent applies it with the Supabase MCP `execute_sql` tool, then runs `--resume-after-sql`.
5. **targeted_test** — a local static server plus a Playwright check that the profile loads, the cover and every clip return HTTP 200, the player appears on `players.html`, and there are no page errors. This check rewrites live GitHub Pages asset URLs to the local server and uses `players.json` (not live Supabase), so it works before deploy.
6. **commit + push** — one commit for every slug in the run, then `git push`. Skipped on `--dry-run`. Also skipped until SQL has been applied (see above).
7. **live_check** — `curl` every 10 seconds until `https://dawsonjones1010-ux.github.io/peach-state-recruits/player/<slug>/` returns 200 and the HTML title contains the player's name. 3-minute timeout.

`--dry-run` runs steps 1–5 against a staging tree (`.publish-staging/`, gitignored) and never writes the repo, Supabase, git, or the live site.

## When to run the full test suites

This pipeline runs only the targeted Playwright check. That is enough for a normal player publish.

Run the full suites (`npm test`, `npm run test:dom`, `npm run test:imports`, and the relevant UI suites) **only when** `player.html`, other templates, `styles.css`, `shared.js`, or the builders' page markup change. A player-data publish does not require them.

## What the agent should do

1. Confirm the owner approved the feature and which package they bought (Basic 3 / Pro 8 / Elite unlimited).
2. Put the approved write-up, cover, and clips in `players-in/<slug>/`. Do not invent copy or edit the media.
3. `bin/add-player.sh --dry-run <slug>` and fix any gate errors.
4. `bin/add-player.sh <slug>`. If there is no database URL, apply the printed SQL via the Supabase MCP `execute_sql` (project `eqghenbqsbvifzkzkdwf`), then `bin/add-player.sh --resume-after-sql <slug>`.
5. Hand the owner the live profile URL.

GitHub Pages still publishes a fixed allowlist (`.github/workflows/pages.yml`). `bin/`, `docs/`, `tools/`, `players-in/`, `.media-cache/`, and `.publish-staging/` are not in that allowlist.

## Limitations

- There is usually no `psql` database URL in the agent environment, so the Supabase step is “emit SQL + apply via MCP,” then `--resume-after-sql` for commit/push/live check.
- The live site reads players from Supabase first. Pushing pages without applying the SQL leaves a shell page that will not list the player or fill the profile.
- Clip 1 is named `clip1.mp4` in sort order of `clips/`. Name the files so the order is the one you want.
- The media cache keys on the source file hash. A changed cover or clip is recompressed; an identical file is skipped.
