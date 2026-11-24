# Peach State Recruits — current website upgrade

Prepared November 20, 2026. This v24 handoff supersedes START_HERE_V22.md for the changes in this export.

## Send this to your website bot

> Merge this updated psr-site-code.zip into the existing Peach State Recruits repository. Read START_HERE_V24.md and WEBSITE_RESEARCH_V24.md first. Preserve the current live config.js, newer player records, uploads, existing videos/ and owner-edited program data. The uploaded source export did not include videos/, so do not replace the complete live repository with an empty media folder. Publish the new recruiting-roadmap.html and changed recruiting scripts/styles, navigation, homepage and data files. The GitHub Pages allowlist includes the new page. No new schema migration is required for the public roadmap or calendar improvements. If the live recruiting database is already installed, optionally run supabase/seed/reviewed_staff_links_v24.sql to fill nine missing official staff links; it preserves existing nonempty links, record_status and last_checked. Do not reseed the whole database. Use the existing earlier migrations only if still needed for the existing account tools. Run npm ci, npm test, npm run test:dom, npm run test:database and npm run test:imports. Test real sign-in, private saving and sign-out with two separate staging accounts before production. Publish through the existing host and return the actual deployed URL and commit. Nothing sends messages to coaches automatically.

## What changed

- New public **Start Here / Recruiting Roadmap** at `recruiting-roadmap.html`: stage-specific next steps, five position-group film checklists, recruiting camp decision worksheet and two-school annual cost comparison.
- Unknown costs stay unknown. Loans/work-study stay separate from grants/scholarships. Enter an explicit 0 where a cost does not apply.
- Optional device persistence, clear/reset, copied plan, printable worksheets and keyboard-accessible tabs. This worksheet is separate from the signed-in My Recruiting plan and does not sync with it.
- Homepage now exposes the free workflow. Desktop navigation is shorter. Phone menus include Start Here and Email Coach consistently.
- DI baseball calendar module distinguishes contact, quiet, dead and shutdown periods; calendar coverage is expressly limited to Aug 1, 2026–Jul 31, 2027. Email Coach and the signed-in timeline use this context. Grade-based dates are labeled as general U.S. high-school boundaries.
- College Finder shows actual dataset coverage, disables an unavailable average-price filter, and links families to the manual cost worksheet.
- Nine official staff links were researched and added with field-specific provenance. No whole-school verification flags were upgraded from that link research.
- Publication and source generators retain the new page, dependencies, menus and reviewed links. Staging tolerates the video folder omitted from this particular export and explains the omission.

## Validation

The final validation results are recorded in WEBSITE_RESEARCH_V24.md. Logic, worksheet integration, existing recruiting integration, local PostgreSQL permissions and Python importer/publishing checks were run. The real browser exercised desktop and phone/tablet responsive contexts, annual-cost calculations, device restoration, copied plans, the camp decision, directory search/details/staff links and homepage navigation.

Limits: no production deployment, live database write, real magic-link delivery, live two-account test, real coach outreach or nationwide re-verification occurred. Existing player video URLs and content were preserved. The source ZIP does not contain the omitted videos/ clips.

## Files to review

`recruiting/roadmap.js`, `recruiting/roadmap-ui.js`, `recruiting/roadmap.css`, `recruiting/calendar.js`, `recruiting-roadmap.html`, `data/reviewed-staff-links-v24.json`, `supabase/seed/reviewed_staff_links_v24.sql`, `tests/roadmap.test.js`, `tests/roadmap.dom.js`, and WEBSITE_RESEARCH_V24.md.
