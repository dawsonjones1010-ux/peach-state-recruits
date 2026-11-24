# Implementation changes and launch notes

## Find My Level

- Removed the duplicated seven-category row.
- Added `estimator/report.js` for measurement context, actual-tool comparison rows, a source-specific NCSA cross-check, three actions, factual coach snapshots, one-hour session handoff and isolated scenario evaluation.
- Added `estimator/report.css` for a clearer report hierarchy, readable input fields, responsive grids, focus states and reduced-motion behavior.
- Made the primary seven-category source visible. NCAA rules, NCSA guidelines, original sample averages and college norms stay separate.
- A narrow numerical gap now prompts a same-protocol retest instead of implying it determines recruiting level.
- Kept age/size context available behind a disclosure so it does not bury the actual result. Height and weight still never change category status.
- An edited unusual measurement invalidates its old confirmation; calendar-date validation rejects impossible dates, fractional class years, invalid positions and invalid batting/throwing choices.
- The recruiting clock distinguishes D2 communication from June 15 contact/visits. D1 communication and visits are separate. Graduated-player text no longer promises unrestricted contact regardless of transfer/signed-aid rules.
- Existing print/share/progress and the explicitly requested Peach State review remain. New email handoff includes actual measurements and context, never an assigned-college claim.

## Email Coach

- Added a public page without a sign-in wall and reused the same editor inside My Recruiting.
- Added pure email logic (`recruiting/email.js`), shared editor (`email-ui.js`), public bootstrap (`email-page.js`), styles and a named source registry.
- Four factual templates; position-aware measurements; separate game/peak fastballs; handed pitcher labels when entered; GPA-scale context; video/profile links; optional size, test scores and coach references; school-specific reasons and event/camp distinctions.
- Three subject choices. Character/word counts and practical editing notes. No “AI recruiting score” or response-percentage claim.
- Recipient, placeholders, graduation year, measurement bounds, peak/game consistency and wrong-school context checks. Copying incomplete work remains possible, while opening the email app requires the core checks and a final visible review.
- Editing a coach/detail field never silently replaces the player's message. Rebuild/restore asks before replacement. Switching school clears school-specific contact/reason/research/questionnaire state and blocks a stale generated-school mismatch until rebuilt.
- Optional local draft saving/restoring/clearing is explicit. Browser storage errors are handled; account data is not silently stored in public-page device storage.
- `.eml` download supports Unicode and folded headers/body; header input cannot inject raw extra lines. Copy and download are alternatives for long mailto messages or computers without a configured email handler.
- Account saving keeps entered context in private `email_drafts.template_context`; owner policies are unchanged. Sent logging reuses the existing atomic RPC and requires the player to choose an optional follow-up date. No email is sent by that RPC.
- Kept the rest of the recruiting workspace and its owner controls. Added public navigation, sitemap entry and the GitHub Pages publish allowlist entry for the new page. Reduced crowded desktop navigation while preserving order/FAQ links elsewhere.

## Checks

- `npm test`: 100 logic/backend tests passed.
- `npm run test:dom`: 31 recruiting-workspace checks + 25 new-feature checks passed.
- `npm run test:database`: 22 PostgreSQL checks passed, including migration, private owner isolation, sent-log retry and rich-context column handling.
- `npm run test:imports`: three existing importer checks passed.
- New JavaScript parses; the two new CSS files parse; target-page local references exist; deployment allowlist includes the new public page.
- Updated the current Playwright acceptance suite and old recruiting suite selectors. The real-browser suite has not been run successfully here. The browser initially displayed the baseline page, then tab focus/connection timed out on both recovery attempts. The v22 mobile layouts and actual mail application integration still require staging checks.

## Remaining setup or limits

1. Apply `supabase/migrations/20261122_email_coach.sql` to save rich private draft context. It is supplied but not run against the production project.
2. Confirm real auth email delivery and redirect configuration on the deployed domain. Use two actual accounts in staging to check real SDK behavior; local fixture tests do not certify live configuration.
3. Browser QA at phone/tablet/desktop sizes, keyboard/focus behavior, print/share, external video access and .eml/email-app compatibility remain required before publication.
4. Seven-tier targets remain publisher heuristics. NCSA does not separately label all three D1 groups. Nobody can honestly infer a guaranteed college destination from these inputs.
5. The original national directory still has incomplete academic/staff/event data. This update improves these two tools and the use of entered school research; it does not turn missing national data into verified facts.
6. Public Email Coach data is transient unless the player explicitly saves a device draft or uses account drafts. A downloaded/copy-pasted email becomes the player's own responsibility to review and send. The feature does not monitor inboxes, opens or replies automatically.
