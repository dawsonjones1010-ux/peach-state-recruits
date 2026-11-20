# Find My Level + Email Coach — v22

Prepared for Peach State Recruits, November 20, 2026.

This is the complete supplied website export with the two requested tools upgraded. It preserves the existing public configuration, images, videos, players, APIs, database files and unrelated pages. The changes are source changes in this ZIP; they have not been published to your production website or applied to your live database.

## Copy this instruction to your website bot

> Merge this complete v22 export into the existing Peach State Recruits repository. Use START_HERE_V22.md as the current handoff. Preserve the current live config.js and any newer player/content/account data. Read UPGRADE_NOTES_V22.md and RESEARCH_NOTES_V22.md. Apply supabase/migrations/20261122_email_coach.sql after the existing recruiting migrations. This adds private per-draft context and corrects the D1 communication-versus-visit guidance. Do not reseed or delete player data. Publish email-coach.html and the new estimator/recruiting JS and CSS; the GitHub Pages allowlist has been updated. Run npm ci, npm test, npm run test:dom, npm run test:database and npm run test:imports. Then run npm run test:ui -- <staging-base-url> and npm run test:recruiting -- <staging-base-url> on a machine with Chromium. Test real sign-in and saving with two separate accounts in staging. Show the updated report and email editor on a phone before publishing. Do not send messages to coaches or invent missing benchmarks, contacts or school facts.

## What the player gets

**Find My Level:** a clearer report; the seven categories displayed once; visible source attribution; a separate NCSA cross-check with pooled groups preserved; a target selector showing actual tool differences; small-gap cautions; measurement-context notes; a hypothetical comparison that does not change actual results; three next actions; a copied factual snapshot; and an explicit local handoff into Email Coach. The existing position/two-way comparisons, study averages, same-age context, height/weight context, print, share, progress and opt-in review remain available.

**Email Coach:** a new public writer at `email-coach.html`, plus the same editor inside My Recruiting > Emails. A player can write without an account. It produces four types of drafts from entered facts: first introduction, update, upcoming event/camp and follow-up. It includes position-specific measurements, clear subjects, academic/video details, a school-specific reason, schedule and optional current-coach references. The player edits and sends the message in their own email application. Draft completeness checks do not predict replies.

**No extra AI API is needed.** Generation runs locally using transparent templates. Account draft storage and the tracker use the site's existing Supabase configuration. Optional public-page device drafts remain on that browser. Nothing emails a coach automatically.

## Install the small database update

Run `supabase/migrations/20261122_email_coach.sql` in the existing project's normal migration workflow or trusted SQL Editor. It adds `email_drafts.template_context` under the table's existing owner-only row policies. It also repairs an existing D1 rule statement that incorrectly grouped visits with the August communication date. No new admin rights or external services are created.

Do not re-run old camp/rule seeds over owner edits just to install this feature. If this is the first recruiting-tools installation, follow README_RECRUITING_UPDATE.md for the earlier migrations first, then apply the v22 migration.

The public Email Coach works without this migration. Signed-in rich draft saving needs the column. If it is absent, the editor keeps the work on screen and explains the missing migration instead of pretending it saved.

## Verify before publishing

Completed locally: 100 logic/backend tests, 56 DOM integration checks, 22 PostgreSQL permission/transaction checks, three Python importer checks, JavaScript syntax, new CSS parsing, local linked assets and deployment packaging rules.

The real browser displayed the initial full site preview, then became unresponsive during QA. The upgraded desktop/phone layouts, clipboard/email application integration and live Supabase magic-link flow have NOT been certified in a real browser. There is a current real-browser suite at `tests/eleven.ui.js` (`npm run test:ui`), ready to run in staging. `tests/estimator.ui.js` preserves the older v21 visual contract and is explicitly marked legacy; do not use those obsolete copy/layout assertions to certify v22.

Real-browser checks should include CF, C, 1B, P and a two-way player; empty/unknown numbers; impossible dates; an unusual number edited after confirmation; changing target categories; a scenario with unchanged actual history; importing measurements into Email Coach; changing schools after writing; preserving manual edits; device draft restore/clear; private account save/restore; retrying sent logging; keyboard access; and widths 390, 768 and 1440 px.

## Entry points

- `find-my-level.html`: assessment + actionable report.
- `email-coach.html`: public writer, no account required.
- `my-recruiting.html#emails`: account drafts + manual sent log.
- `recruiting/research.js`: visible source registry and limits.
- `UPGRADE_NOTES_V22.md`: implementation details and remaining limits.
- `RESEARCH_NOTES_V22.md`: what each source supports and which claims were deliberately avoided.
