/*
  Peach State Recruits: recruiting tools logic (pure functions, no DOM, no network).
  Used by the browser pages and by tests/recruiting.logic.test.js.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PSRLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO"];
  const STATES = {
    AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",
    DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",
    KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
    MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
    NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
    PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",
    VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"
  };
  const STATE_NAMES = Object.values(STATES).sort();

  // ---------------------------------------------------------------- dates
  function toISO(d) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const x = d instanceof Date ? d : new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }
  function parseISO(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function addDays(d, n) { const x = parseISO(d) || new Date(d); x.setDate(x.getDate() + n); return x; }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
  function fmtDate(s, opts) {
    const d = parseISO(s); if (!d) return "";
    return d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
  }

  // High school class from grad year. School year turns over Aug 1.
  function classYear(gradYear, today) {
    const t = parseISO(today) || new Date();
    const schoolYearEnd = t.getMonth() >= 7 ? t.getFullYear() + 1 : t.getFullYear(); // spring of the current school year
    const yearsLeft = gradYear - schoolYearEnd; // 0 = senior
    const names = { 0: "senior", 1: "junior", 2: "sophomore", 3: "freshman" };
    if (yearsLeft < 0) return { key: "graduated", label: "Graduated", yearsLeft };
    if (yearsLeft > 3) return { key: "middle", label: "Middle school", yearsLeft };
    return { key: names[yearsLeft], label: names[yearsLeft][0].toUpperCase() + names[yearsLeft].slice(1), yearsLeft };
  }
  // Aug 1 before junior year, June 15 after sophomore year
  function keyDates(gradYear) {
    return {
      d1Contact: `${gradYear - 2}-08-01`,
      d2Contact: `${gradYear - 2}-06-15`,
      juniorYearEnds: `${gradYear - 1}-06-01`
    };
  }

  // ---------------------------------------------------------------- directory search
  function norm(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); }
  function filterPrograms(list, f) {
    f = f || {};
    const q = norm(f.q).trim();
    const terms = q ? q.split(/\s+/) : [];
    const levels = (f.levels && f.levels.length) ? new Set(f.levels) : null;
    const states = (f.states && f.states.length) ? new Set(f.states) : null;
    return list.filter(p => {
      if (levels && !levels.has(p.level)) return false;
      if (states && !states.has(p.state)) return false;
      if (f.conference && p.conference !== f.conference) return false;
      if (f.verifiedOnly && p.record_status !== "verified") return false;
      if (f.hasAcademics && p.avg_net_price == null && p.admission_rate == null) return false;
      if (f.maxNetPrice && (p.avg_net_price == null || p.avg_net_price > f.maxNetPrice)) return false;
      if (terms.length) {
        const hay = norm(`${p.name} ${p.city || ""} ${p.state || ""} ${p.conference || ""}`);
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    }).sort((a, b) => {
      if (f.sort === "state") return (a.state || "").localeCompare(b.state || "") || a.name.localeCompare(b.name);
      if (f.sort === "level") return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }

  // Find My Level result labels -> directory levels. No program-specific scores.
  function levelsFromFindMyLevel(labels) {
    const out = new Set();
    (labels || []).forEach(l => {
      const s = String(l).toLowerCase();
      if (s.includes("d1")) out.add("NCAA D1");
      else if (s.includes("d2")) out.add("NCAA D2");
      else if (s.includes("d3")) out.add("NCAA D3");
      else if (s.includes("naia")) out.add("NAIA");
      else if (s.includes("juco") || s.includes("junior college")) out.add("JUCO");
    });
    return LEVELS.filter(l => out.has(l));
  }

  // ---------------------------------------------------------------- profile helpers
  function fullName(p) { return [p && p.first_name, p && p.last_name].filter(Boolean).join(" "); }
  function heightText(inches) { if (!inches) return ""; return `${Math.floor(inches / 12)}'${inches % 12}"`; }
  function metricsLine(p) {
    const m = (p && p.metrics) || {};
    const bits = [];
    if (m.fb_velo) bits.push(`FB ${m.fb_velo} mph`);
    if (m.exit_velo) bits.push(`exit velo ${m.exit_velo} mph`);
    if (m.sixty) bits.push(`60 in ${m.sixty}`);
    if (m.if_velo) bits.push(`IF velo ${m.if_velo} mph`);
    if (m.of_velo) bits.push(`OF velo ${m.of_velo} mph`);
    if (m.c_velo) bits.push(`C velo ${m.c_velo} mph`);
    if (m.pop) bits.push(`pop ${m.pop}`);
    return bits.join(", ");
  }
  function profileMissing(p) {
    const need = [["first_name", "first name"], ["last_name", "last name"], ["grad_year", "grad year"],
      ["primary_position", "position"], ["high_school", "high school"], ["contact_email", "email"]];
    return need.filter(([k]) => !p || !p[k]).map(([, l]) => l);
  }

  // ---------------------------------------------------------------- emails
  const KINDS = {
    introduction: "Introduction",
    update: "Update",
    event_invite: "Event invitation",
    follow_up: "Follow-up"
  };
  function signature(p) {
    const lines = [fullName(p) || "[Your name]"];
    const l2 = [p.grad_year ? `Class of ${p.grad_year}` : "", p.primary_position || "", p.high_school || ""].filter(Boolean).join(" | ");
    if (l2) lines.push(l2);
    if (p.club_team) lines.push(`Club: ${p.club_team}${p.club_coach ? ` (Coach ${p.club_coach})` : ""}`);
    if (p.contact_email) lines.push(p.contact_email);
    if (p.phone) lines.push(p.phone);
    if (p.video_url) lines.push(`Video: ${p.video_url}`);
    if (p.profile_url) lines.push(`Profile: ${p.profile_url}`);
    return lines.join("\n");
  }
  function greeting(coachName) { return coachName ? `Coach ${String(coachName).trim().split(/\s+/).slice(-1)[0]},` : "Coach,"; }

  function buildEmail(kind, ctx) {
    const p = ctx.profile || {};
    const school = (ctx.program && ctx.program.name) || "[School]";
    const name = fullName(p) || "[Your name]";
    const pos = p.primary_position || "[position]";
    const gy = p.grad_year || "[grad year]";
    const ht = heightText(p.height_in);
    const size = [ht, p.weight_lb ? `${p.weight_lb} lb` : ""].filter(Boolean).join(", ");
    const metrics = metricsLine(p);
    const acad = [p.gpa ? `${p.gpa} GPA` : "", p.sat ? `${p.sat} SAT` : "", p.act ? `${p.act} ACT` : ""].filter(Boolean).join(", ");
    const g = greeting(ctx.coachName);
    let subject = "", body = "";

    if (kind === "introduction") {
      subject = `${gy} ${pos} ${name}${p.high_school ? ` - ${p.high_school}` : ""}`;
      body = [
        g, "",
        `My name is ${name}, a ${gy} ${pos}${p.high_school ? ` at ${p.high_school}` : ""}${p.hs_city ? ` in ${p.hs_city}${p.hs_state ? `, ${p.hs_state}` : ""}` : ""}. I'm very interested in ${school} and wanted to introduce myself.`,
        "",
        [size ? `Size: ${size}` : "", metrics ? `Numbers: ${metrics}` : "", acad ? `Academics: ${acad}` : "", p.intended_major ? `Planned major: ${p.intended_major}` : ""].filter(Boolean).join("\n") || "[Add your size, numbers and academics]",
        "",
        p.video_url ? `Here is my video: ${p.video_url}` : "[Add a link to your highlight video]",
        "",
        `${ctx.personalNote || `[One or two sentences on why ${school} specifically: academics, program, location.]`}`,
        "",
        "I would appreciate any feedback, and I'd love to know what your recruiting process looks like for my class.",
        "", "Thank you for your time,", signature(p)
      ].join("\n");
    } else if (kind === "update") {
      subject = `Update from ${name} (${gy} ${pos})`;
      body = [
        g, "",
        `I wanted to send a quick update since I last reached out about ${school}.`, "",
        ctx.updateNote || (metrics ? `My latest numbers: ${metrics}.` : "[What's new: new numbers, stats, video, grades, or upcoming events.]"),
        "",
        p.video_url ? `Updated video: ${p.video_url}` : "",
        "",
        `I'm still very interested in ${school}. Thank you for your time.`,
        "", signature(p)
      ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
    } else if (kind === "event_invite") {
      const ev = ctx.event || {};
      const when = ev.start_date ? fmtDate(ev.start_date, { weekday: "short", month: "short", day: "numeric" }) : "[date]";
      const where = [ev.venue, ev.city, ev.state].filter(Boolean).join(", ") || "[location]";
      subject = `${name} (${gy} ${pos}) playing ${when}${ev.city ? ` in ${ev.city}` : ""}`;
      body = [
        g, "",
        `I'll be playing at ${ev.title || "[event name]"} on ${when} at ${where}${ev.time_note ? ` (${ev.time_note})` : ""}.`,
        ctx.eventDetail || "[Team name, jersey number and field/game times if you have them.]",
        "",
        `If you or someone from ${school} will be there, I'd love for you to see me play.`,
        p.video_url ? `\nIn the meantime, here is my video: ${p.video_url}` : "",
        "", "Thank you,", signature(p)
      ].join("\n");
    } else if (kind === "follow_up") {
      const last = ctx.lastSentOn ? fmtDate(ctx.lastSentOn) : "a few weeks ago";
      subject = `Following up: ${name} (${gy} ${pos})`;
      body = [
        g, "",
        `I reached out on ${last} about ${school} and wanted to follow up.`, "",
        ctx.followNote || "[One new thing since your last message: a new number, game result, or upcoming event.]",
        "",
        `I'm still very interested in ${school}, and I'd appreciate any feedback on what you'd need to see from me.`,
        p.video_url ? `\nVideo: ${p.video_url}` : "",
        "", "Thank you,", signature(p)
      ].join("\n");
    } else throw new Error("Unknown email kind: " + kind);
    return { subject, body: body.replace(/\n{3,}/g, "\n\n") };
  }

  function mailtoUrl(to, subject, body) {
    const q = [];
    if (subject) q.push("subject=" + encodeURIComponent(subject));
    if (body) q.push("body=" + encodeURIComponent(body));
    return `mailto:${encodeURIComponent(to || "").replace(/%40/g, "@")}${q.length ? "?" + q.join("&") : ""}`;
  }

  // ---------------------------------------------------------------- tracker
  function schoolStatus(programId, comms) {
    const mine = comms.filter(c => c.program_id === programId).sort((a, b) => String(b.occurred_on).localeCompare(String(a.occurred_on)));
    const sent = mine.filter(c => c.direction === "sent");
    const recv = mine.filter(c => c.direction === "received");
    return {
      total: mine.length,
      sent: sent.length,
      received: recv.length,
      lastSentOn: sent[0] ? sent[0].occurred_on : null,
      lastReceivedOn: recv[0] ? recv[0].occurred_on : null,
      lastOn: mine[0] ? mine[0].occurred_on : null,
      awaitingReply: !!(recv[0] && (!sent[0] || recv[0].occurred_on >= sent[0].occurred_on) && recv[0].kind !== "other")
    };
  }
  function dueFollowUps(comms, today) {
    const t = toISO(today || new Date());
    return comms.filter(c => c.follow_up_on && !c.follow_up_done && c.follow_up_on <= t)
      .sort((a, b) => a.follow_up_on.localeCompare(b.follow_up_on));
  }

  // ---------------------------------------------------------------- personal plan (transparent rules)
  // Each rule returns null or a task. Higher priority shows first. Every task says why it appeared.
  const PLAN_RULES = [
    {
      key: "profile_basics", priority: 100,
      test(c) {
        const miss = profileMissing(c.profile);
        if (!miss.length) return null;
        return { title: "Finish your recruiting profile", detail: `Missing: ${miss.join(", ")}. Every email draft uses these details.`, why: "Your profile is incomplete.", action: { label: "Edit profile", href: "#profile" } };
      }
    },
    {
      key: "followups_due", priority: 95, dynamic: true,
      test(c) {
        const due = dueFollowUps(c.comms, c.today);
        if (!due.length) return null;
        const first = due[0];
        const school = c.programName(first.program_id) || "a school";
        return { title: due.length === 1 ? `Follow up with ${school}` : `${due.length} follow-ups are due`, detail: `Follow-up date ${fmtDate(first.follow_up_on)} has arrived${due.length > 1 ? ` (earliest: ${school})` : ""}.`, why: "A follow-up date you set has passed.", action: { label: "Draft follow-up", href: `#emails?kind=follow_up&program=${first.program_id || ""}` }, subkey: due.map(d => d.id).join(",") };
      }
    },
    {
      key: "reply_waiting", priority: 94, dynamic: true,
      test(c) {
        const waiting = c.saved.filter(s => schoolStatus(s.program_id, c.comms).awaitingReply);
        if (!waiting.length) return null;
        const school = c.programName(waiting[0].program_id);
        return { title: `Reply to ${school}`, detail: "You logged a message from this program and haven't logged a response yet.", why: "Latest logged message came from a coach.", action: { label: "Log your reply", href: `#tracker?program=${waiting[0].program_id}` }, subkey: waiting.map(w => w.program_id).join(",") };
      }
    },
    {
      key: "d1_contact_window", priority: 88,
      test(c) {
        if (!c.profile.grad_year) return null;
        if (c.profile.levels_of_interest && c.profile.levels_of_interest.length && !c.profile.levels_of_interest.includes("NCAA D1")) return null;
        const d = keyDates(c.profile.grad_year).d1Contact;
        const days = daysBetween(c.today, d);
        if (days < 0 || days > 75) return null;
        return { title: `Get ready for ${fmtDate(d)}`, detail: `NCAA Division I baseball coaches can begin recruiting communication with your class on ${fmtDate(d)}. Have your video, profile and target list ready before then.`, why: `D1 contact date is ${days} days away.`, ruleRef: "d1_contact_start", action: { label: "Review saved schools", href: "#saved" } };
      }
    },
    {
      key: "video", priority: 80,
      test(c) {
        if ((c.profile.prep || {}).video || c.profile.video_url) return null;
        return { title: "Get a coach-ready highlight video", detail: "Coaches will ask for video before anything else. Add the link to your profile so every email includes it.", why: "No video link on your profile.", action: { label: "See video packages", href: "index.html#packages" } };
      }
    },
    {
      key: "first_intros", priority: 75,
      test(c) {
        const notContacted = c.saved.filter(s => s.stage !== "not_a_fit" && schoolStatus(s.program_id, c.comms).sent === 0);
        if (!notContacted.length || profileMissing(c.profile).length) return null;
        const n = Math.min(3, notContacted.length);
        return { title: `Send ${n} introduction email${n > 1 ? "s" : ""}`, detail: `Start with ${notContacted.slice(0, n).map(s => c.programName(s.program_id)).join(", ")}. Find the coach's email on the school's official staff page.`, why: `${notContacted.length} saved school${notContacted.length > 1 ? "s have" : " has"} no logged contact.`, action: { label: "Draft introduction", href: `#emails?kind=introduction&program=${notContacted[0].program_id}` } };
      }
    },
    {
      key: "updates_due", priority: 72, dynamic: true,
      test(c) {
        const stale = c.saved.filter(s => {
          const st = schoolStatus(s.program_id, c.comms);
          return st.lastSentOn && daysBetween(st.lastSentOn, c.today) >= 60 && ["contacted", "talking"].includes(s.stage);
        });
        if (!stale.length) return null;
        return { title: `Send an update to ${c.programName(stale[0].program_id)}`, detail: "It has been 60+ days since your last message. Share something new: numbers, stats, grades or your schedule.", why: "Last logged message is 60+ days old.", action: { label: "Draft update", href: `#emails?kind=update&program=${stale[0].program_id}` }, subkey: stale.map(s => s.program_id).join(",") };
      }
    },
    {
      key: "build_list", priority: 70,
      test(c) {
        if (c.saved.length >= 10) return null;
        return { title: c.saved.length ? `Add ${10 - c.saved.length} more schools to your list` : "Save your first 10 schools", detail: "A list of about 10 or more programs across more than one level keeps your options open. Use the College Finder filters for level and state.", why: `You have ${c.saved.length} saved school${c.saved.length === 1 ? "" : "s"}.`, action: { label: "Open College Finder", href: "colleges.html" } };
      }
    },
    {
      key: "ncaa_register", priority: 65,
      test(c) {
        const cy = c.profile.grad_year ? classYear(c.profile.grad_year, c.today) : null;
        if (!cy || !["sophomore", "junior", "senior"].includes(cy.key)) return null;
        const lv = c.profile.levels_of_interest || [];
        if (lv.length && !lv.some(l => l === "NCAA D1" || l === "NCAA D2")) return null;
        if ((c.profile.prep || {}).ncaa_registered) return null;
        return { title: "Register with the NCAA Eligibility Center", detail: "Required to play at an NCAA Division I or II school. Division III players can start with a free Profile Page.", why: `You're a ${cy.label.toLowerCase()} and haven't marked this done.`, ruleRef: "ncaa_register", action: { label: "Open official site", href: "https://www.ncaa.org/eligibility-center/register/", external: true } };
      }
    },
    {
      key: "naia_register", priority: 60,
      test(c) {
        const cy = c.profile.grad_year ? classYear(c.profile.grad_year, c.today) : null;
        if (!cy || !["junior", "senior"].includes(cy.key)) return null;
        const lv = c.profile.levels_of_interest || [];
        const savedNaia = c.saved.some(s => (c.programLevel(s.program_id) === "NAIA"));
        if (!lv.includes("NAIA") && !savedNaia) return null;
        if ((c.profile.prep || {}).naia_registered) return null;
        return { title: "Register with the NAIA Eligibility Center", detail: "Every student-athlete must register at PlayNAIA to play at an NAIA school.", why: "NAIA is on your list.", ruleRef: "naia_register", action: { label: "Open PlayNAIA", href: "https://play.mynaia.org/", external: true } };
      }
    },
    {
      key: "second_level", priority: 50,
      test(c) {
        if (c.saved.length < 5) return null;
        const lv = new Set(c.saved.map(s => c.programLevel(s.program_id)).filter(Boolean));
        if (lv.size !== 1) return null;
        return { title: "Add schools at a second level", detail: `All of your saved schools are ${[...lv][0]}. Adding another level gives you more options.`, why: "Every saved school is the same level.", action: { label: "Open College Finder", href: "colleges.html" } };
      }
    },
    {
      key: "find_camp", priority: 40,
      test(c) {
        if (!c.saved.length || c.savedCamps.length) return null;
        return { title: "Look for a camp at a school on your list", detail: "Camps put you in front of a program's own coaches. Check the Camp Finder and each school's camp page.", why: "You have saved schools but no saved camps.", action: { label: "Open Camp Finder", href: "camps.html" } };
      }
    }
  ];

  function planCandidates(ctx) {
    const c = Object.assign({ profile: {}, saved: [], comms: [], savedCamps: [], today: toISO(new Date()), programName: () => "", programLevel: () => "" }, ctx);
    c.profile = c.profile || {};
    const out = [];
    PLAN_RULES.forEach(r => {
      const t = r.test(c);
      if (t) out.push(Object.assign({ rule_key: r.key, priority: r.priority, dynamic: !!r.dynamic }, t));
    });
    return out.sort((a, b) => b.priority - a.priority);
  }

  // Merge rule candidates with saved task state; return {next: top 3 open, all}
  function planView(candidates, savedTasks, today, limit) {
    const t = toISO(today || new Date());
    const byKey = new Map((savedTasks || []).filter(s => s.rule_key).map(s => [s.rule_key, s]));
    const items = [];
    candidates.forEach(cand => {
      const st = byKey.get(cand.rule_key);
      let status = "open";
      if (st) {
        if (st.status === "done" || st.status === "dismissed") {
          // a dynamic rule comes back when its underlying data changes (different subkey)
          if (cand.dynamic && st.rule_subkey && cand.subkey && st.rule_subkey !== cand.subkey) status = "open";
          else status = st.status;
        } else if (st.status === "postponed" && st.postponed_until && st.postponed_until > t) status = "postponed";
      }
      items.push(Object.assign({}, cand, {
        id: st ? st.id : null, status,
        title: st && st.edited ? st.title : cand.title,
        detail: st && st.edited && st.detail != null ? st.detail : cand.detail,
        postponed_until: st ? st.postponed_until : null
      }));
    });
    (savedTasks || []).filter(s => !s.rule_key).forEach(s => {
      let status = s.status;
      if (status === "postponed" && (!s.postponed_until || s.postponed_until <= t)) status = "open";
      items.push({ id: s.id, rule_key: null, custom: true, title: s.title, detail: s.detail || "", why: "Added by you.", priority: s.due_on && s.due_on <= t ? 96 : 55, status, due_on: s.due_on, postponed_until: s.postponed_until });
    });
    items.sort((a, b) => b.priority - a.priority);
    const open = items.filter(i => i.status === "open");
    return { next: open.slice(0, limit || 3), open, all: items };
  }

  // ---------------------------------------------------------------- camps
  function filterCamps(list, f, today) {
    f = f || {};
    const t = toISO(today || new Date());
    const q = norm(f.q).trim();
    return list.filter(c => {
      if ((c.end_date || c.start_date) < t) return false;          // hide past events
      if (c.record_status === "hidden") return false;
      if (f.states && f.states.length && !f.states.includes(c.state)) return false;
      if (f.gradYear && c.grad_years && c.grad_years.length && !c.grad_years.includes(+f.gradYear)) return false;
      if (f.from && c.start_date < f.from) return false;
      if (f.to && c.start_date > f.to) return false;
      if (f.maxPrice && c.price_cents != null && c.price_cents > f.maxPrice * 100) return false;
      if (f.levels && f.levels.length && !(c.level && f.levels.includes(c.level))) return false;
      if (q && !norm(`${c.title} ${c.host_name || ""} ${c.city || ""} ${c.state || ""}`).includes(q)) return false;
      return true;
    }).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }
  function isStale(record, today, days) {
    if (!record.last_checked) return true;
    return daysBetween(record.last_checked, today || new Date()) > (days || 45);
  }

  function icsEscape(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsFold(line) {
    const out = []; let s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
    out.push(s); return out.join("\r\n");
  }
  function buildICS(camps, opts) {
    opts = opts || {};
    const stamp = (opts.now ? new Date(opts.now) : new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peach State Recruits//Camp Finder//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    camps.forEach(c => {
      const start = c.start_date.replace(/-/g, "");
      const endExcl = toISO(addDays(c.end_date || c.start_date, 1)).replace(/-/g, "");
      const desc = [c.host_name, c.time_note, c.price_cents != null ? `Price: $${(c.price_cents / 100).toFixed(2).replace(/\.00$/, "")}` : "", c.eligibility_note, c.registration_url ? `Register: ${c.registration_url}` : "", `Source: ${c.source_url}`].filter(Boolean).join("\n");
      lines.push("BEGIN:VEVENT",
        `UID:${c.id}@peachstaterecruits`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${endExcl}`,
        icsFold(`SUMMARY:${icsEscape(c.title)}`),
        icsFold(`LOCATION:${icsEscape([c.venue, c.city, c.state].filter(Boolean).join(", "))}`),
        icsFold(`DESCRIPTION:${icsEscape(desc)}`));
      if (c.registration_url) lines.push(icsFold(`URL:${c.registration_url}`));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  // Travel estimate: every input is the player's own assumption; nothing is looked up.
  const TRAVEL_DEFAULTS = { miles_one_way: 0, mpg: 25, gas_price: 3.25, nights: 0, hotel_rate: 140, rooms: 1, people: 2, meals_per_day: 3, meal_cost: 15, days: 1, other: 0, include_registration: true };
  function travelEstimate(input, camp) {
    const t = Object.assign({}, TRAVEL_DEFAULTS, input || {});
    const n = k => Math.max(0, Number(t[k]) || 0);
    const gas = n("mpg") ? (n("miles_one_way") * 2 / n("mpg")) * n("gas_price") : 0;
    const hotel = n("nights") * n("hotel_rate") * Math.max(1, n("rooms"));
    const meals = n("days") * n("meals_per_day") * n("meal_cost") * Math.max(1, n("people"));
    const reg = t.include_registration && camp && camp.price_cents != null ? camp.price_cents / 100 : 0;
    const other = n("other");
    const round = v => Math.round(v * 100) / 100;
    const total = round(gas + hotel + meals + reg + other);
    return { gas: round(gas), hotel: round(hotel), meals: round(meals), registration: round(reg), other: round(other), total };
  }
  function money(v) { return v == null ? "" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

  // ---------------------------------------------------------------- admin import
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ""));
    if (!nonEmpty.length) return [];
    const head = nonEmpty[0].map(h => h.trim().toLowerCase());
    return nonEmpty.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }
  function slugify(s) { return norm(s).replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  const PROGRAM_FIELDS = ["slug", "name", "level", "association", "conference", "city", "state", "website_url", "athletics_url", "roster_url", "schedule_url", "camps_url", "questionnaire_url", "ipeds_unitid", "undergrad_enrollment", "admission_rate", "sat_25", "sat_75", "act_25", "act_75", "grad_rate", "tuition_in_state", "tuition_out_state", "avg_net_price", "academic_year", "academic_source_url", "listing_source", "listing_source_url", "record_status", "last_checked", "review_note"];
  const NUMERIC = new Set(["ipeds_unitid", "undergrad_enrollment", "admission_rate", "sat_25", "sat_75", "act_25", "act_75", "grad_rate", "tuition_in_state", "tuition_out_state", "avg_net_price"]);
  function normalizeProgramRow(r) {
    const out = {}; const errors = [];
    PROGRAM_FIELDS.forEach(k => {
      if (!(k in r)) return;
      let v = r[k]; if (v === "" || v == null) { out[k] = null; return; }
      if (NUMERIC.has(k)) { const n = Number(String(v).replace(/[$,%\s]/g, "")); if (isNaN(n)) errors.push(`${k} is not a number`); else out[k] = (k === "admission_rate" || k === "grad_rate") && n > 1 ? n / 100 : n; }
      else out[k] = String(v).trim();
    });
    if (!out.name) errors.push("name is required");
    if (out.level && !LEVELS.includes(out.level)) errors.push(`level must be one of ${LEVELS.join(", ")}`);
    if (!out.slug && out.name) out.slug = slugify(out.name);
    ["website_url", "athletics_url", "roster_url", "schedule_url", "camps_url", "questionnaire_url", "academic_source_url", "listing_source_url"].forEach(k => {
      if (out[k] && !/^https?:\/\//i.test(out[k])) errors.push(`${k} must start with http(s)://`);
    });
    if (out.last_checked && !/^\d{4}-\d{2}-\d{2}$/.test(out.last_checked)) errors.push("last_checked must be YYYY-MM-DD");
    if ((out.avg_net_price != null || out.tuition_in_state != null || out.admission_rate != null) && !out.academic_year) errors.push("academic_year is required when academic or cost numbers are given");
    return { row: out, errors };
  }

  return {
    LEVELS, STATES, STATE_NAMES, KINDS, PLAN_RULES, TRAVEL_DEFAULTS, PROGRAM_FIELDS,
    toISO, parseISO, addDays, daysBetween, fmtDate, classYear, keyDates,
    filterPrograms, levelsFromFindMyLevel, fullName, heightText, metricsLine, profileMissing,
    buildEmail, mailtoUrl, schoolStatus, dueFollowUps, planCandidates, planView,
    filterCamps, isStale, buildICS, travelEstimate, money, parseCSV, slugify, normalizeProgramRow
  };
});
