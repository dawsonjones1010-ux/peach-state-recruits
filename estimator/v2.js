/*
  Find My Level v2 (v17): context layers on top of the v1 read. Pure functions, no DOM.
  Uses data/level-benchmarks-v1.1-additions.json. NOTHING here changes which level is highlighted:
  every record in the additions file is context only, and v1's logic.js decides every status.
  - "When they were your age": PBR Indiana sophomore-year cohorts, shown only for numbers
    measured in the sophomore year. No projection, no growth math.
  - Recruiting clock: calendar facts from the grad year and today's date.
  - Method chips: how each number was measured. Numbers are never converted.
  - Advanced fields: spin, IVB, extension, bat speed. Context only.
  - The result sentence for the CTA, and the opt-in review payload (sent only when the player taps Send).
  PBR_WI_E is "hidden_until_owner_review" and is never shown.
*/
(function (root, factory) {
  const node = typeof module === "object" && module.exports;
  const api = factory(node ? require("./logic.js") : root.PSRLevel, node ? require("./summary.js") : root.PSRLevelSummary, node ? require("./config.js") : root.PSRLevelConfig);
  if (node) module.exports = api; else root.PSRLevelV2 = api;
})(typeof self !== "undefined" ? self : this, function (L, U, CFG) {
  "use strict";
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const visible = (add) => (add.sophomore_cohorts || []).filter(c => c.use !== "hidden_until_owner_review");
  const cohort = (add, id) => visible(add).find(c => c.source_id === id) || null;
  const src = (add, id) => (add.sources || []).find(s => s.id === id) || null;

  // ---------- Grade when measured ----------
  // meta.grade is the player's own answer ("8" = 8th grade or earlier, "9".."12", "grad"); otherwise from grad year + date.
  function gradeWhenMeasured(input) {
    const meta = input.meta || {};
    if (meta.grade) return { grade: meta.grade === "grad" ? 13 : parseInt(meta.grade, 10), from: "answer" };
    const g = L.gradeAt(input.gradYear, meta.date);
    return { grade: g, from: g == null ? null : "date" };
  }

  // ---------- "When they were your age" ----------
  const E_GROUP = { SS: "SS", LF: "OF", CF: "OF", RF: "OF", C: "C", "1B": "1B/3B", "3B": "1B/3B" }; // 2B: PBR publishes no 2B group
  const VELO_KEY = { SS: "if_velo_mph", OF: "of_velo_mph", C: "c_velo_mph", "1B/3B": "if_velo_mph" };
  const VELO_IN = { infield: "ifVelo", outfield: "ofVelo", catcher: "cVelo" };
  const VELO_LABEL = { infield: "Infield throw", outfield: "Outfield throw", catcher: "Catcher throw" };
  function cmp(v, mean, unit) {
    if (!isNum(mean)) return { mean: null };
    if (!isNum(v)) return { mean };
    const d = unit === "s" ? r2(v - mean) : r1(v - mean);
    let text;
    if (Math.abs(d) < 1e-9) text = "Same as the group";
    else if (unit === "s") text = `You ${Math.abs(d).toFixed(2)} s ${d < 0 ? "faster" : "slower"}`;
    else text = `You ${d > 0 ? "+" : "−"}${Math.abs(d)} ${unit}`;
    return { mean, diff: d, text };
  }
  // Bands are listed from the top down; a value takes the first band whose lower edge it reaches
  // (a value between two published edges, like 94.95, stays in the lower band).
  function bandFor(bands, v) {
    if (!isNum(v)) return null;
    return bands.find(x => x.min == null || v >= x.min) || null;
  }
  function bandPhrase(label) {
    if (/and up/.test(label)) return "at or above the 98th percentile";
    if (/^Below/.test(label)) return "below the 16th percentile";
    const m = label.match(/(\d+)\w* to (\d+)\w*/); return m ? `between the ${m[1]}th and ${m[2]}th percentile` : label;
  }
  function pitcherAge(add, input, read) {
    const P = cohort(add, "PBR_IN_P"), E = cohort(add, "PBR_IN_E"), m = input.metrics || {};
    const hk = read.hand || "all", groups = [], facts = [];
    const peak = isNum(m.maxFb) ? m.maxFb : null;
    let band = null, spinBand = null;
    if (P) {
      const rows = [{ label: "Peak fastball", unit: "mph", you: peak, cols: ["D1", "Power 4"].map(k => Object.assign({ col: k === "D1" ? "Eventual D1" : "Eventual Power 4" }, cmp(peak, P.means.peak_fb_mph[k][hk], "mph"))) }];
      if (isNum(m.fbSpin)) rows.push({ label: "Fastball spin", unit: "rpm", you: m.fbSpin, cols: ["D1", "Power 4"].map(k => Object.assign({ col: k === "D1" ? "Eventual D1" : "Eventual Power 4" }, cmp(m.fbSpin, P.means.fb_spin_rpm[k][hk], "rpm"))) });
      if (isNum(m.bbSpin)) rows.push({ label: "Breaking-ball spin", unit: "rpm", you: m.bbSpin, cols: ["D1", "Power 4"].map(k => Object.assign({ col: k === "D1" ? "Eventual D1" : "Eventual Power 4" }, cmp(m.bbSpin, P.means.bb_spin_rpm[k][hk], "rpm"))) });
      const b = bandFor(P.in_sample_bands_peak_fb_mph, peak);
      if (b) band = `Your ${peak} mph peak sits ${bandPhrase(b.label)} of Indiana's eventual D1 arms as sophomores.`;
      const sb = isNum(m.fbSpin) ? bandFor(P.in_sample_bands_fb_spin_rpm, m.fbSpin) : null;
      if (sb) spinBand = `Your ${m.fbSpin} rpm fastball spin sits ${bandPhrase(sb.label)} of that group.`;
      groups.push({ source: src(add, "PBR_IN_P"), title: `Eventual D1 pitchers, measured as sophomores${read.hand ? ` (${read.hand} means)` : ""}`, region: P.region, n: P.n, classes: P.classes, earlyOnly: false, smallSample: false, rows });
      if (isNum(peak) && peak < 85) facts.push(P.context_facts[0]);
    }
    if (E) {
      const ek = read.hand || "max_fb_all";
      groups.push({ source: src(add, "PBR_IN_E"), title: "Early D1 commits, measured as sophomores", region: E.region, n: E.n, classes: E.classes, earlyOnly: true, smallSample: false,
        rows: [{ label: "Max fastball", unit: "mph", you: peak, cols: ["Power 4", "Mid-major D1"].map(k => Object.assign({ col: k }, cmp(peak, E.pitchers[k][ek], "mph"))) }] });
    }
    return { kind: "pitching", title: "Pitcher", groups, band, spinBand, facts, needsPeak: !isNum(peak) };
  }
  function hitterAge(add, input, read) {
    const E = cohort(add, "PBR_IN_E"), m = input.metrics || {}; if (!E) return null;
    const pg = CFG.POSITION_GROUPS[read.position], grp = E_GROUP[read.position], groups = [];
    const velo = m[VELO_IN[pg.throwTest]];
    const LV = ["Power 4", "Mid-major D1"];
    if (grp) {
      const bp = E.by_position[grp], vk = VELO_KEY[grp];
      groups.push({ source: src(add, "PBR_IN_E"), title: `Early D1 commits at ${grp}, measured as sophomores`, region: E.region, n: bp.n, classes: E.classes, earlyOnly: true,
        smallSample: LV.some(k => bp.n[k] < (E.small_sample_warning_below_n || 6)),
        rows: [
          { label: "60-yard dash", unit: "s", you: isNum(m.sixty) ? m.sixty : null, cols: LV.map(k => Object.assign({ col: k, n: bp.n[k] }, cmp(m.sixty, bp[k].sixty_s, "s"))) },
          { label: VELO_LABEL[pg.throwTest], unit: "mph", you: isNum(velo) ? velo : null, cols: LV.map(k => Object.assign({ col: k, n: bp.n[k] }, cmp(velo, bp[k][vk], "mph"))) },
          { label: "Peak exit velocity", unit: "mph", you: isNum(m.maxEv) ? m.maxEv : null, cols: LV.map(k => Object.assign({ col: k, n: bp.n[k] }, cmp(m.maxEv, bp[k].peak_ev_mph, "mph"))) },
          { label: "Bat speed", unit: "mph", you: isNum(m.batSpeed) ? m.batSpeed : null, cols: LV.map(k => Object.assign({ col: k, n: bp.n[k] }, cmp(m.batSpeed, bp[k].bat_speed_mph, "mph"))) }
        ] });
    }
    const ho = E.hitters_overall;
    groups.push({ source: src(add, "PBR_IN_E"), title: "All early D1 commit hitters, measured as sophomores", region: E.region, n: E.n, classes: E.classes, earlyOnly: true, smallSample: false, overall: true,
      rows: [
        { label: "60-yard dash", unit: "s", you: isNum(m.sixty) ? m.sixty : null, cols: LV.map(k => Object.assign({ col: k }, cmp(m.sixty, ho[k].sixty_s, "s"))) },
        { label: "Position throw (any position)", unit: "mph", you: isNum(velo) ? velo : null, cols: LV.map(k => Object.assign({ col: k }, cmp(velo, ho[k].pos_velo_mph, "mph"))) },
        { label: "Peak exit velocity", unit: "mph", you: isNum(m.maxEv) ? m.maxEv : null, cols: LV.map(k => Object.assign({ col: k }, cmp(m.maxEv, ho[k].peak_ev_mph, "mph"))) },
        { label: "Bat speed", unit: "mph", you: isNum(m.batSpeed) ? m.batSpeed : null, cols: LV.map(k => Object.assign({ col: k }, cmp(m.batSpeed, ho[k].bat_speed_mph, "mph"))) }
      ] });
    const facts = E.context_facts.slice();
    return { kind: "position", title: U.tabLabel(read), groups, facts, noPositionGroup: !grp ? `PBR published no ${read.position} group, so only the all-hitters numbers are shown.` : null };
  }
  function youngPanel(add, input, reads) {
    const g = gradeWhenMeasured(input);
    if (g.grade == null) return { status: "unknown", grade: null, line: "Tell us what grade you were in when you got these numbers (step 3) to see how eventual D1 players measured at the same age." };
    if (g.grade <= 9) return { status: "freshman", grade: g.grade, line: "No freshman-year data has been published for eventual college players, so there's no same-age comparison yet." };
    if (g.grade !== 10) return { status: "none", grade: g.grade, line: null };
    const out = reads.map(r => r.kind === "pitching" ? pitcherAge(add, input, r) : hitterAge(add, input, r)).filter(Boolean);
    return { status: "panel", grade: 10, gradeFrom: g.from, reads: out,
      intro: "Your numbers are from your sophomore year, so here is how players who went on to D1 measured at the same age. Context only: it doesn't change your level, and we don't project growth." };
  }

  // ---------- Recruiting clock ----------
  const ymd = (y, m, d) => new Date(y, m - 1, d, 12);
  const dayDiff = (a, b) => Math.ceil((a - b) / 86400000);
  const longDate = (d) => `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  function clock(add, gradYear, today) {
    const cal = add.recruiting_calendar; if (!cal || !isNum(gradYear)) return null;
    today = today || new Date();
    const t = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const J = gradYear - 2; // junior year starts in the fall of this year
    if (t >= ymd(gradYear, 7, 1)) return { graduated: true, title: "Your recruiting clock", line: `Class of ${gradYear} has graduated high school. Review transfer, enrollment and signed-aid restrictions with each school before arranging recruiting contact.` };
    const dateFor = (r) => {
      if (/^Aug 1 before junior year/.test(r.when)) return ymd(J, 8, 1);
      if (/^Sept 1 of junior year/.test(r.when)) return ymd(J, 9, 1);
      if (/^June 15 after sophomore year/.test(r.when)) return ymd(J, 6, 15);
      return null; // year-round / any time
    };
    const rules = cal.rules.filter(r => !/VERIFY/i.test(r.when)).map(r => { const d = dateFor(r); return Object.assign({}, r, { date: d, open: !d || t >= d, dateText: d ? longDate(d) : r.when }); });
    const order = ["D1", "D2", "D3", "NAIA", "JUCO"];
    const openLevels = order.filter(l => rules.some(r => r.level === l && r.open));
    const closedLevels = order.filter(l => rules.some(r => r.level === l) && !openLevels.includes(l));
    const future = rules.filter(r => r.date && !r.open).sort((a, b) => a.date - b.date);
    const next = future[0] ? { level: future[0].level, event: future[0].event, date: future[0].date, dateText: longDate(future[0].date), days: dayDiff(future[0].date, t) } : null;
    const W = cal.commitment_waves_indiana, w = W.waves;
    let wave;
    if (t < ymd(J, 8, 1)) wave = { key: "before", text: `Before the first commitment wave. In Indiana, about ${w[0].d1_commits_approx} of the roughly ${W.d1_commits_per_class_approx} D1 commitments per class came in the first ~5 months after Aug 1 of junior year.` };
    else if (t < ymd(J + 1, 1, 1)) wave = { key: "wave1", text: `You're in the first commitment wave (first ~5 months after Aug 1 of junior year). In Indiana, about ${w[0].d1_commits_approx} of the roughly ${W.d1_commits_per_class_approx} D1 commitments per class came in this window.` };
    else if (t < ymd(J + 1, 6, 1)) wave = { key: "between", text: `You're between the first two commitment waves. In Indiana, another ${w[1].d1_commits_approx} D1 commitments came from June to early-November signing day before senior year.` };
    else if (t < ymd(J + 1, 11, 15)) wave = { key: "wave2", text: `You're in the second commitment wave (June to early-November signing day). In Indiana, about ${w[1].d1_commits_approx} D1 commitments per class came in this window.` };
    else wave = { key: "wave3", text: `You're past senior-year signing day. In Indiana, ${w[2].commits_approx} commitments per class came after signing day.` };
    return { title: "Your recruiting clock", gradYear, openLevels, closedLevels, rules, next, wave,
      waveNote: `Commitment waves are one state's data (PBR Indiana, about ${W.all_college_commits_per_class_approx} college commitments per class). Calendar rules are re-checked every ${cal.review_every}.`, source: src(add, cal.source_id) };
  }

  // ---------- Method chips ----------
  const EV_TYPE = { tee: "Tee", bp: "Live BP", game: "Game" };
  const DEVICE = { trackman: "TrackMan", rapsodo: "Rapsodo", pocket: "Pocket Radar", gun: "Radar gun", stadium: "Stadium gun", hittrax: "HitTrax", blast: "Blast", other: "Other device" };
  const VELO_KEYS = ["maxFb", "typFb", "ifVelo", "ofVelo", "cVelo"], SPIN_KEYS = ["fbSpin", "bbSpin", "extension", "ivb"];
  function chips(input, key) {
    const mt = input.methods || {}, meta = input.meta || {}, out = [];
    if (key === "sixty") out.push(mt.sixty === "laser" ? "Laser" : mt.sixty === "hand" ? "Hand-timed" : "Timing unknown");
    if (key === "maxEv" || key === "avgEv") { out.push(EV_TYPE[mt.ev] || "Tee/BP/game unknown"); out.push(DEVICE[mt.evDevice] || "Device unknown"); }
    if (VELO_KEYS.includes(key)) out.push(DEVICE[mt.veloDevice] || "Device unknown");
    if (SPIN_KEYS.includes(key)) out.push(DEVICE[mt.pitchDevice] || "Device unknown");
    if (meta.date) { const d = new Date(meta.date + "T12:00:00"); if (!isNaN(d)) out.push(`${MON[d.getMonth()]} ${d.getFullYear()}`); } else out.push("Date unknown");
    out.push(meta.source === "self" ? "Self-reported" : meta.source === "event" ? "Event result" : meta.source === "device" ? "Device report" : "Source unknown");
    if (meta.link) out.push("Link saved");
    return out;
  }
  function chipNote(input, key) {
    const mt = input.methods || {};
    if (key === "sixty" && mt.sixty === "hand") return "Hand times usually read faster than laser times.";
    if ((key === "maxEv" || key === "avgEv") && mt.ev === "tee") return "Exit velocity off a tee usually reads lower than off pitched balls. Not converted.";
    return "";
  }

  // ---------- Advanced fields (context only) ----------
  function advanced(add, data, input, reads) {
    const m = input.metrics || {}, rows = [];
    const P = cohort(add, "PBR_IN_P");
    const pr = reads.find(r => r.kind === "pitching"), hk = pr && pr.hand ? pr.hand : "all";
    if (pr && P) {
      if (isNum(m.fbSpin)) { const b = bandFor(P.in_sample_bands_fb_spin_rpm, m.fbSpin);
        rows.push({ key: "fbSpin", label: "Fastball spin", unit: "rpm", you: m.fbSpin, cols: ["D1", "Power 4"].map(k => Object.assign({ col: k === "D1" ? "Eventual D1 (as sophomores)" : "Eventual Power 4 (as sophomores)" }, cmp(m.fbSpin, P.means.fb_spin_rpm[k][hk], "rpm"))),
          note: b ? `${bandPhrase(b.label).replace(/^./, c => c.toUpperCase())} of Indiana's eventual D1 arms as sophomores (n ${P.n}).` : "" }); }
      if (isNum(m.bbSpin)) rows.push({ key: "bbSpin", label: "Breaking-ball spin", unit: "rpm", you: m.bbSpin, cols: ["D1", "Power 4"].map(k => Object.assign({ col: k === "D1" ? "Eventual D1 (as sophomores)" : "Eventual Power 4 (as sophomores)" }, cmp(m.bbSpin, P.means.bb_spin_rpm[k][hk], "rpm"))), note: "" });
    }
    if (pr && isNum(m.ivb)) {
      const pc = data.college_four_seam_average_dataset;
      rows.push({ key: "ivb", label: "Induced vertical break", unit: "in", you: m.ivb, cols: pc.records.filter(r => !pr.hand || r.hand === pr.hand).map(r => Object.assign({ col: `College ${r.level} ${r.hand}` }, cmp(m.ivb, r.mean_ivb_inches, "in"))), note: "College pitchers' four-seam averages (Pitching Coach U, v1 data). Not high school recruit numbers." });
    }
    if (pr && isNum(m.extension)) rows.push({ key: "extension", label: "Extension", unit: "ft", you: m.extension, cols: [], note: "Recorded with your result. No published level comparison exists." });
    if (reads.some(r => r.kind === "position") && isNum(m.batSpeed)) {
      const B = (add.reference_ranges || []).find(x => x.source_id === "BLAST");
      if (B) rows.push({ key: "batSpeed", label: "Bat speed (Blast)", unit: "mph", you: m.batSpeed, ranges: Object.keys(B.ranges).map(k => { const [lo, hi] = B.ranges[k]; return { col: k, lo, hi, where: m.batSpeed < lo ? "Below this range" : m.batSpeed > hi ? "Above this range" : "Within this range" }; }), cols: [], note: "Vendor reference ranges, not level cutoffs." });
    }
    if (!rows.length) return null;
    return { title: "Advanced numbers (context only)", note: "These never change your level. Spin, IVB, extension and bat speed depend on the device.", rows, sources: [src(add, "PBR_IN_P"), src(add, "BLAST")].filter(Boolean) };
  }

  // ---------- Result sentence for the CTA ----------
  const TOOLW = { hitting: "bat", running: "speed", throwing: "arm", pitching: "fastball" };
  function ctaSentence(read) {
    const h = U.headline(read);
    if (h.level) {
      const c = read.categories.find(x => x.key === h.level);
      const tools = c.compared.map(k => /pop/i.test(c.tools[k].metric || "") ? "pop time" : TOOLW[k]);
      const list = tools.length <= 1 ? tools.join("") : tools.slice(0, -1).join(", ") + " and " + tools[tools.length - 1];
      return read.kind === "pitching" ? `Your fastball already meets the listed ${U.LONG[h.level]} velocity target. Coaches still need to see you pitch on film.`
        : `Your ${list} already meet${tools.length === 1 ? "s" : ""} the listed ${U.LONG[h.level]} targets. Coaches still need to see them on film.`;
    }
    if (read.categories.some(c => c.compared.length)) return "Numbers are only part of it. Coaches still need to see your game on film.";
    return "Add your numbers, then put your film in front of coaches.";
  }

  // ---------- Opt-in review payload ----------
  const METRIC_KEYS = ["maxFb", "typFb", "fbSpin", "bbSpin", "extension", "ivb", "strikePct", "era", "whip", "maxEv", "avgEv", "batSpeed", "sixty", "thirty", "ifVelo", "ofVelo", "cVelo", "pop", "avg", "obp", "slg"];
  function cleanHandle(h) { const s = String(h || "").trim().replace(/^@/, ""); return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null; }
  function reviewPayload(handle, input, result) {
    const m = input.metrics || {}, metrics = {};
    METRIC_KEYS.forEach(k => { if (isNum(m[k])) metrics[k] = m[k]; });
    const meta = input.meta || {}, mt = input.methods || {};
    const methods = {}; ["sixty", "ev", "evDevice", "veloDevice", "pitchDevice"].forEach(k => { if (mt[k]) methods[k] = mt[k]; });
    ["date", "environment", "method", "source", "grade"].forEach(k => { if (meta[k]) methods[k] = meta[k]; });
    if ((m.repertoire || []).length) methods.repertoire = m.repertoire.slice(0, 12);
    return { ig_handle: cleanHandle(handle), grad_year: input.gradYear || null, positions: [input.primary, input.secondary].filter(Boolean).join("/"),
      throws: input.throws || null, bats: input.bats || null, metrics, methods,
      headline: (result.reads || []).map(r => `${U.tabLabel(r)}: ${U.headline(r).text}`).join(" | ").slice(0, 400), data_version: String(result.dataVersion || "") };
  }

  return { gradeWhenMeasured, youngPanel, clock, chips, chipNote, advanced, ctaSentence, cleanHandle, reviewPayload, bandFor, bandPhrase, DEVICE, EV_TYPE, longDate };
});
