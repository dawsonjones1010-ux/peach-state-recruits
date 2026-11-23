# Find My Level: Scoring Engine v3 (site v42)

Model version `3.0.0`. Replaces the v40 (pitcher) and v41 (position) scoring. Published benchmarks are unchanged.

## What didn't change

- **Benchmarks.** These are untouched:
  - the PSR pitcher screening ranges and performance targets in `estimator/pitcher.js`;
  - the NextCommit targets and v1.2 fills in `data/`.
  A test pins them ("a published benchmark is never changed by v3").
- **Evaluations.** Pitcher and position evaluations stay separate. Two-way players still get one tab per role.
- **Scores.** A score is never an offer probability; the disclaimer stays under the scores.
- **Measurements.** Nothing is estimated. Sitting velocity is never derived from peak, and a 30 is never converted to a 60.
- **Existing features.** All of these still work: what-if, share, email handoff, school and camp links, cross-check, committed-player comparisons, same-grade and size context, and progress history.

## Where the numbers live

Every tunable v3 setting is in `estimator/fit-core.js` → `CONFIG`:
- weights;
- the velocity penalty;
- selection thresholds;
- classification labels;
- confidence values;
- precision.

All of these are Peach State Recruits' provisional product settings, not published standards. The UI labels them that way.

## Pitchers

| Category | P4 | Mid | Low | D2 | D3 | NAIA | JUCO* |
|---|---|---|---|---|---|---|---|
| Velocity | 45 | 40 | 35 | 30 | 25 | 30 | 35 |
| Command | 15 | 20 | 25 | 30 | 30 | 25 | 20 |
| Secondary pitches | 20 | 20 | 20 | 20 | 20 | 20 | 20 |
| Pitch characteristics | 15 | 10 | 10 | 10 | 10 | 10 | 10 |
| Game performance | 5 | 10 | 10 | 10 | 15 | 15 | 15 |

\*JUCO weights are provisional.

**Secondary pitches and pitch characteristics are shown, not scored.** There's no pitch-shape benchmark yet, so their weight is shared across the scored categories. Projection was removed.

**Velocity**
- Score = sitting 75% + peak 25%. It was 60/40.
- Peak only: scored, but marked incomplete and confidence is capped at 64.

**Command**
- Scored on strike % (25), BB/9 (25) and K/BB (15), normalized over whatever is entered.
- First-pitch strike % and zone % are collected and shown but have no benchmark, so they aren't scored.

**Performance**
- Scored on ERA, WHIP and K/9.
- BB/9 and K/BB count only in command, so nothing is counted twice.
- K-BB% is shown only.

**Velocity shortfall.** The old multiplicative velocity gate is replaced by a points deduction based on how far sitting velocity is below the level's sitting minimum:

| Sitting gap | Deduction |
|---|---|
| 0–1 mph | 0 |
| >1–2 mph | 3 |
| >2–3 mph | 7 |
| >3–5 mph | 12 |
| >5 mph | 18 |

Final = clamp(weighted score − deduction, 0, 100). The unrounded value is kept internally; the display is rounded.

## Position players

| Position | Hitting | Defense | Speed | Performance |
|---|---|---|---|---|
| C | 35 | 45 | 10 | 10 |
| 1B | 65 | 15 | 10 | 10 |
| 2B | 35 | 30 | 25 | 10 |
| SS | 30 | 40 | 20 | 10 |
| 3B | 45 | 35 | 10 | 10 |
| CF | 35 | 30 | 25 | 10 |
| LF / RF | 50 | 25 | 15 | 10 |

**What gets scored**
- Only metrics with a published benchmark: max exit velocity, throwing velocity or pop time, and the 60.
- Each scored category is labeled "Limited assessment", and the UI lists what isn't benchmarked yet.

**Game stats**
- AVG, OBP and SLG never change the score.
- Derived and shown: OPS, ISO, K% and BB%.
- Plate appearances set the sample-size part of confidence:
  - under 30 is insufficient;
  - 30–74 is limited;
  - 75–149 is moderate;
  - 150+ is stronger.

**Weakest-tool multiplier removed.** Instead, a level can only be the primary target when:
- every core tool (category weight 20 or more) scores at least 75;
- no core tool is missing.

## Picking the target

**Classifications**

| Score | Label |
|---|---|
| 90+ | Strong |
| 80–89 | Competitive |
| 70–79 | Developing |
| 60–69 | Below typical |
| under 60 | Significant gaps |

**Primary target**
- The highest of P4, Mid, Low, D2, D3 and NAIA that scores 85 or more with its core benchmarks met.
- If none qualifies: "Further evaluation needed", plus the closest category.
- If confidence is Insufficient, the target is shown as provisional rather than hidden.

**Stretch target**
- The next category up, only if it scores 65 or more, the fastball or core tools are plausible (within 5 mph for pitchers, every tool at 50+ for hitters), and there's a measurable gap.
- Otherwise the page says "Not established with current data".

**Additional opportunities:** any other ladder level at 80 or more.

**JUCO** has its own "JUCO recruiting pathway" section; it isn't a rung.

**Ties:** the higher category is the target and the tie is stated.

## Confidence (never changes a score)

Confidence = 0.3 completeness + 0.3 verification + 0.2 recency + 0.2 sample.

**Verification**

| Source | Value |
|---|---|
| Event or device result with a link | 100 |
| Event or device result without a link | 85 |
| Self-reported, electronic | 70 |
| Self-reported or hand-timed | 50 |
| Unknown | 30 |

**Recency**

| Measured | Value |
|---|---|
| Within 90 days | 100 |
| Within 180 days | 85 |
| Within 365 days | 65 |
| Older or no date | 35 |

**Labels**

| Score | Label |
|---|---|
| 85+ | High |
| 65–84 | Moderate |
| 40–64 | Limited |
| under 40 | Insufficient |

Optional advanced data never counts against completeness.

## New on the results page

- A "Your college baseball recruiting evaluation" header.
- A radar chart. Unscored categories show as dashed spokes labeled "Not scored", never as zero.
- Standout-tool badges, shown only when a number meets the Power 4 benchmark. They add no points.
- A confidence breakdown.
- A "Where you stand" table with:
  - a gap column;
  - a status color (green meets / yellow within one step / red below / gray not scored);
  - a verification column.
- Top 3 priorities. Each has a "why it matters" line, a next step and the score impact. They're ranked by core status, then score impact, then position importance, not by smallest gap. Gaps inside measurement error are flagged.
- Expandable per-level math: category score × share, deduction and final score.
- A development outlook built from saved results. With fewer than two dated points 30+ days apart it says "Insufficient progression data".
- What-if shows current fit vs hypothetical fit, the change and any classification change.

**New optional inputs**
- Pitchers: breaking-ball type, first-pitch strike %, zone %, and whiff % for the breaking ball and changeup.
- Hitters: plate appearances, strikeouts, walks and competition level.

**Saved history** now stores the measurement date, model version and benchmark version. It stays append-only.

## Impact on example players (v41 → v3)

| Player | P4 | Mid | Low | D2 | D3 | NAIA | JUCO | Primary |
|---|---|---|---|---|---|---|---|---|
| Doc RHP 87/90, elite command | 32→47 | 75→89 | 93→98 | 99→100 | 99→100 | 99→100 | 89→94 | Low → Mid |
| RHP 84/87, no stats | 0→0 | 31→47 | 68→80 | 86→92 | 99→100 | 95→97 | 80→88 | D2 → D2 |
| LHP 86/89, 3.40 ERA, 5.0 BB/9 | 27→44 | 47→53 | 68→60 | 70→56 | 88→82 | 88→85 | 92→96 | D3 → NAIA |
| RHP peak only 92 | 45→63 | 83→90 | 99→100 | 99→100 | 99→100 | 99→100 | 94→96 | Low → Mid (provisional, incomplete) |
| CF 94 / 6.75 / 88 | 79→87 | 91→95 | 91→95 | 94→98 | 98→99 | 99→100 | 99→100 | Mid → P4 |
| SS 92 / 6.9 / 85 | 73→80 | 78→86 | 78→86 | 94→98 | 97→99 | 99→100 | 99→100 | D2 → Mid |
| 1B 99 / 7.4 / 80 | 95→96 | 95→96 | 95→96 | 97→97 | 99→99 | 97→97 | 99→99 | P4 → P4 |
| C 88 / pop 2.05 | 56→65 | 74→82 | 86→92 | 91→94 | 95→97 | 91→94 | 91→94 | Low → Low |

**What moved and why**
- **Pitchers inside a level's velocity range score higher.** The old multiplier pulled every category down whenever velocity wasn't at the top of the range.
- **Poor command now costs more at D2, D3 and NAIA.** Command carries 25–30% there; see the LHP walking 5 per 9.
- **Position players with no tool far below a line score higher.** The weakest-tool multiplier is gone. A core tool well below the line still blocks a level as the primary target.

## Tests

- `tests/estimator.v3.test.js`: 22 new tests (spec items 1–20, history versions, benchmark pins).
- Updated v40/v41 expectations, where v3 intentionally changes results, in `tests/estimator.pitcher.test.js` and `tests/estimator.position.test.js`.
- Unit suite: 174 passing (was 151).
- Browser suite (`tests/eleven.ui.js`): 52 passing (was 44). New checks cover the six ladder tiles plus a separate JUCO section, the radar chart, per-level explanations, the verification column and current-vs-hypothetical what-if.
- `tests/eleven.dom.js` is updated but still unrun. jsdom can't be installed here: network access is off and `npm i jsdom` fails.
