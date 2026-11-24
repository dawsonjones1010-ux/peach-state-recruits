# What was fixed and what still needs work

November 20, 2026. Changes apply to the supplied ZIP only. No production deployment or live account changes were made.

## Implemented fixes

| Area | Fix |
| --- | --- |
| Account setup | Missing SDK/config no longer silently creates insecure browser-only accounts. Public browsing remains available; saving explains the setup requirement. Preview must be explicitly selected and warns against using real details. |
| Sign-in/session handling | Supabase auth callbacks defer database work to avoid the documented callback deadlock. Session/sign-out errors are surfaced. Account changes reload the workspace and stale loads cannot replace newer account state. |
| Live directory IDs | Database failures no longer silently substitute fallback program/camp IDs that cannot be saved into UUID foreign keys. Paging has deterministic ordering. |
| Database bootstrap | Standalone recruiting admin membership/helper added; the site's existing admin helper is preserved. Explicit least-privilege grants and owner RLS policies are included, with an idempotent repair migration for existing installs. |
| Private data | Player isolation checked in PostgreSQL. A communication cannot point at another player's private draft. Admins see directory controls and aggregate counts, not player private rows. |
| Sent emails | Draft + sent log + school stage are reconciled through an atomic database operation. Retries use the same draft, preventing duplicate tracker entries. Failed logging leaves a recoverable draft. This operation never sends email. |
| Composer | Added school-specific/update details; coach/event edits preserve a manually edited message. Template replacement asks before overwriting edits. Coach email validation, saved-camp invitation handoff, draft camp IDs, and drafts for removed saved schools are handled. |
| Tracker/plan | Same-day messages use entry timestamps to determine who last replied. Later communication supersedes old follow-up reminders. Dynamic tasks reopen when their underlying school/message/date changes. Video task lets a player add their own video link. |
| Saved camps | Past saved camps remain available to their owner rather than disappearing when an event ends. Hidden/removed events remain restricted. |
| Camp costs | Unknown-price camps no longer pass a budget filter. Zero-dollar filters work. Missing registration fees or invalid MPG are labeled as partial estimates, not complete totals. Ongoing camps match overlapping date filters. |
| Calendar | Invalid dates rejected; UTF-8 lines folded to the calendar byte limit; event IDs and URL fields cannot inject calendar properties through raw newlines. |
| Finder | Hidden listings filtered out, malformed detail URLs handled, Back returns directly to results, conference/sort/budget filters persist in the URL, and sourced cost/academic filters expose coverage. |
| Official links | Added owner-editable baseball staff and academic-major catalog links across schema, data layer, import and detail pages. No guessed URLs were filled in. |
| Imports | Required level, finite numbers/ranges, real dates, source/year requirements, verified-record provenance, malformed CSV and duplicate headers validated. Sparse live imports preserve omitted fields. Interrupted imports clearly explain that prior rows may have saved and can be retried by slug. |
| Admin/forms | New program placeholder IDs stripped before live UUID writes; ambiguous school names do not silently attach a camp to the wrong campus. Form controls use explicit named lookup, avoiding collisions with native form properties. |
| Data corrections | Rosemont varsity program hidden after its Spring 2026 ending; West Florida's Fall 2026 ASUN/D1 transition and postseason restriction documented. D2 communication is distinguished from first off-campus contact/official visits. Source URLs are retained with records and in repair SQL. |
| Data loading | Added official College Scorecard CSV preparation utility, exact institution matching, unmatched review output and provenance. It does not invent costs/admission data or fuzzy-match campuses. |
| Developer handoff | Repaired broken test command, added dependency manifest/lockfile, configuration example, new/existing database instructions, cache-version bump and this gap report. |

## Remaining gaps, in priority order

1. **Connect and test live accounts.** The archive omits the existing config/shared assets and does not supply a live project. Your bot must merge it into the real repository, run migrations, set public credentials, configure email delivery and redirect URLs, and grant your real auth user admin membership.
2. **Populate and verify the data.** There are 1,662 directory rows: 1,631 listing-only, 20 marked checked in the original data, 10 needing review and 1 hidden. Only 1,661 are publicly visible. Most official baseball/staff/questionnaire/camp links are still missing. Existing checked labels were retained from the source package; this repair did not independently recheck every one of those links. The remaining closure/association/duplicate warnings need authoritative review before claiming a complete current national program list.
3. **Load academics/costs.** Zero schools have loaded academic/cost numbers. The importer and filters now exist, but the official dataset still needs to be downloaded and reviewed. SAT totals and school-level major offerings are not manufactured. Major catalogs can be linked; a searchable national major database is not included.
4. **Expand and refresh camps.** Four starter camp listings only. Three have unknown prices. The original listed checks were November 19, 2026; no new camp availability, sold-out status or every listing's contents were verified during this repair. This is not a complete national event calendar. Prices/date/coaches need checking before travel or payment.
5. **Finish live/browser QA.** Real magic-link delivery, browser session changes, email-client opening, full-site integration, phone layouts and accessibility need a staging test. Chromium could not start in this execution environment, so no claim is made that the real-browser Playwright suite passed.
6. **Keep product claims accurate.** Emails/replies and sent dates are entered by the player. There is no automatic inbox sync, email open tracking, verified coach activity, automatic coach outreach or predictive admission/recruiting match score. The recruiting plan is a transparent task engine. Those would be separate features with additional services and verification.

## Verification completed

- 31 Node logic/backend tests passed.
- 31 DOM integration checks passed using jsdom and local fixture accounts: composer, save/log/retry, task creation, account separation/sign-out, finder routing, camp travel dialog, owner program edit/staff link persistence and camp creation.
- 22 PostgreSQL checks passed using PGlite and Supabase role/auth fixtures: fresh + repeatable migrations, all seeds/targeted repairs, owner isolation, cross-owner draft protection, admin permissions/counts, anonymous access and historical saved camps.
- 3 Python importer tests passed: exact matches/source preservation, ambiguous/fuzzy matches withheld and authoritative institution ID behavior.
- JavaScript syntax and archive integrity checked.

These are local implementation checks. They do not constitute verification of all directory facts, all camp facts, live Supabase configuration or a rendered mobile site.

## Sources for corrected facts

- NCAA Division II Manual: https://web3.ncaa.org/lsdbi/reports/getReport/90010 (13.1.3.1 permits communication at any time; face-to-face off-campus contact and official visits have separate first dates).
- Rosemont official merger FAQ: https://rosemont.edu/college/merger-with-villanova/ (varsity athletics through Spring 2026).
- West Florida official announcement: https://goargos.com/news/2026/4/2/uwf-athletics-announces-move-to-ncaa-division-i-athletics-joins-atlantic-sun-conference-united-athletic-conference.aspx (Fall 2026 transition; full NCAA postseason eligibility after reclassification in 2029).
- College Scorecard official data: https://collegescorecard.ed.gov/data/ and https://collegescorecard.ed.gov/files/InstitutionDataDocumentation.pdf.
- Supabase auth callback issue: https://supabase.com/kb/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0.
