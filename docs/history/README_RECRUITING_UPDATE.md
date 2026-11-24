# Peach State Recruits recruiting tools — corrected update

Updated November 20, 2026. This is an UPDATE OVERLAY for the existing Peach State Recruits website, not a standalone replacement for the entire site.

## Give this to your website bot

> Merge the contents of this ZIP into the existing website repository. Read README_RECRUITING_UPDATE.md and FIXES_AND_GAPS.md first. Keep the existing config.js, shared.js, branding images, complete estimator directory and other existing assets. Merge package.json scripts/dependencies with the existing package rather than discarding unrelated settings. Install the recruiting database migration and seeds in the order below; use the repair migration if the original migration already ran. Connect the existing public Supabase client, configure magic-link redirect URLs, and grant the owner's real auth user ID admin membership using trusted SQL. Run the included tests and then test real sign-in, two separate player accounts, owner access, and phone layouts in staging. Show a working preview before publishing. Never substitute preview accounts for live authentication or invent missing college data.

## What the ZIP contains

Four connected tools: College Finder + saved schools; email templates + manual communication tracking; a rules-based recruiting plan; and camp discovery + saved camps/calendar/travel estimates. The owner editor manages directory records, camps and rule sources.

The ZIP does NOT include the base site's config.js, shared.js, favicon/images, complete estimator implementation, full pre-existing test suite or the user's live Supabase project. Those were missing from the supplied update archive. Keep them from the existing repository. Private accounts need Supabase; GitHub Pages alone only hosts the static frontend.

## Database installation

Use trusted Supabase SQL Editor access, never a frontend service-role key.

**New install:**

1. Run `supabase/migrations/20261120_recruiting_tools.sql`.
2. Run `supabase/seed/programs_seed.sql`.
3. Run `supabase/seed/rules_camps_seed.sql`.

**If the original update's migration already ran:**

1. Run `supabase/migrations/20261121_recruiting_repairs.sql`. It is an idempotent repair, including the independent admin helper and sent-email RPC. Do not delete existing player tables.
2. Seed programs if they have not been loaded. Program seed updates only existing `unverified` rows; it intentionally preserves reviewed/hidden rows.
3. Apply `supabase/seed/reviewed_data_repairs.sql` for the reviewed rule/program corrections on an existing installation.
4. Load camp/rule seeds only if the starter rows are missing. The original rules/camps seed is an upsert and overwrites those starter records; do not routinely rerun it over owner edits.

If you use a migration runner, put both numbered migrations in its normal sequence. Running both on a new database is safe and was tested.

### Owner membership

Sign in once with the real owner email, then copy its UUID from Supabase Authentication > Users. Run trusted SQL with that UUID:

```sql
insert into public.recruiting_admins (user_id)
values ('REPLACE_WITH_REAL_AUTH_USER_UUID')
on conflict do nothing;
```

Email spelling and `admin@` do not grant production admin rights. The helper also recognizes the existing site's trusted `public.is_admin()` when present, without replacing it. Admins can edit PUBLIC directory data and see counts, but cannot read players' private recruiting profiles, notes, drafts or messages through these policies.

### Frontend configuration and magic links

Merge the public settings in `config.recruiting.example.js` into the EXISTING config.js, or reuse the existing `window.PSR_SB` client. Only public publishable/anon credentials belong in browser code. In Supabase Authentication URL Configuration set the canonical Site URL and permit the deployed `my-recruiting.html` redirect (including the repository subdirectory on GitHub Pages). Use exact staging URLs for staging. Enable the email provider and configure delivery before expecting magic links to arrive.

An unconfigured or failed live backend is now clearly unavailable. It does not silently create browser-only accounts. Explicit `?demo=1` is a local preview, with made-up details only. `?demo=0` exits it. Preview email addresses have NO ownership verification and are unsuitable for real player data.

## Academic and cost data

The supplied directory has **zero populated academic/cost records**. The update adds the import pipeline and filters; it does not invent admissions numbers, tuition, majors or school-specific recruiting odds.

Download an institution-level cohort CSV from the official [College Scorecard data page](https://collegescorecard.ed.gov/data/). Use the actual cohort/reporting year from the source documentation, not the date you download it. The bundled importer is for a SINGLE year-specific institution CSV; most-recent mixed-year files require reviewing their field-year mapping before use.

```sh
python tools/import_scorecard.py path/to/MERGED2023_24_PP.csv --year 2023-24 --output prepared/scorecard.csv
```

It matches an explicit UNITID or a UNIQUE exact normalized institution name + state. It writes one or more CSVs ready for the owner Import screen and a separate unmatched CSV for human review. It does not fuzzy-match campuses. Review every match before import. To preserve existing sourced values, files with different published fields are separated; blank academic fields are not generated as replacements. An unmatched record needs an authoritative institution ID or reviewed name correction.

Costs are institution-level published averages, not a player's scholarship or net-price quote. Grad rate is the published four-year first-time/full-time 150%-time measure where available; do not compare it as if it described every student. The importer deliberately does not sum SAT section percentiles into a false total SAT percentile. Admission/academic numbers need both a reporting year and source URL. Staff and majors/catalog links can now be added in the owner editor; no national major catalog is bundled.

## Validation

Install development dependencies with `npm install` (Python 3 is needed only for import scripts/tests).

```sh
npm test
npm run test:dom
npm run test:database
npm run test:imports
```

The DOM suite uses real app scripts with local fixture storage and a fixed November 20, 2026 date. The database suite uses PGlite PostgreSQL with Supabase auth role fixtures; it does not connect to or modify a live project. No test sends email.

For the full site's Playwright check, serve the merged site over HTTP, install Chromium with `npx playwright install chromium`, and run `npm run test:ui -- http://127.0.0.1:8099/`. Use `CHROME=/path/to/chromium` if needed. That suite expects the full site's original home page, estimator and shared assets. It was not passed here: this environment prevented Chromium from starting. DOM tests do not certify responsive layouts, keyboard behavior in a real browser, email-client handoff, deliverability or Supabase magic-link/session integration. Finish those in staging.

## Publishing and data maintenance

Merge and preview first. No live site was changed by this repair. Review the 10 `needs_review` programs, verify current official baseball pages, import academics, and expand/recheck camps before describing this as a complete nationwide database. Cache versions on changed recruiting assets were advanced to v21. The directory builder remains reproducible; it does not scrape or contact accounts at runtime. Its seed protects already reviewed rows, so reviewed corrections have a separate repair SQL file.
