/* Start Here: the three-step path (find your level, pick colleges, email coaches), then everything else.
   Reads the Find My Level summary saved on this device (psr_level_summary_v1). Nothing is uploaded. */
(function () {
  "use strict";
  const root = document.getElementById("startSteps");
  if (!root) return;
  const L = window.PSRLogic, P = window.PSRPicks;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let sum = null;
  try { const v = JSON.parse(localStorage.getItem("psr_level_summary_v1") || "null"); if (v && v.v === 1) sum = v; } catch (_) {}
  const homeState = () => { try { return localStorage.getItem((P && P.STATE_KEY) || "psr_home_state") || ""; } catch (_) { return ""; } };
  let programs = null;

  function when(iso) { const d = new Date(iso); return isNaN(d) ? "" : `${MON[d.getMonth()]} ${d.getDate()}`; }
  function step(n, state, title, body) {
    return `<li class="st-step st-${state}"><span class="st-n" aria-hidden="true">${state === "done" ? "✓" : n}</span>
      <div class="st-body"><h3>${title}${state === "done" ? '<span class="st-sr"> (done)</span>' : ""}</h3>${body}</div></li>`;
  }
  function step1() {
    if (!sum) return step(1, "now", "Find your level", `<p>Enter your measurables, like fastball velo, exit velo and 60 time. See which college levels your numbers line up with. It's free and takes about 3 minutes.</p>
      <a class="btn btn-peach" href="find-my-level.html">Find my level</a>`);
    const lv = sum.level;
    return step(1, "done", "Find your level", `<p class="st-result">${lv ? `<b>${esc(lv.label)}</b><span>${esc(lv.score)}/100 ${lv.primary ? "best college match" : "closest level"}</span>` : `<b>Working toward the published targets</b>`}</p>
      <p class="st-meta">${esc([sum.position ? sum.position.charAt(0).toUpperCase() + sum.position.slice(1) : "", sum.gradYear ? "Class of " + sum.gradYear : "", sum.t ? "checked " + when(sum.t) : ""].filter(Boolean).join(", "))}. <a href="find-my-level.html">See full results or update</a></p>`);
  }
  function step2() {
    if (!sum || !sum.bands || !sum.bands.length)
      return step(2, "locked", "Pick colleges at your level", `<p>Finish step 1 and we'll list colleges at your level, closest to home first.</p><p class="st-meta"><a href="colleges.html">Or browse all 1,600+ programs</a></p>`);
    return step(2, "now", "Pick colleges at your level", `<div id="stPicks"><p class="st-meta">Loading colleges…</p></div>`);
  }
  function step3() {
    const ready = sum && sum.bands && sum.bands.length;
    return step(3, ready ? "next" : "locked", "Email coaches", `<p>Send each coach a short, personal email with your real numbers and a link to your video. Email Coach writes the first draft for you.</p>
      <a class="btn ${ready ? "btn-line st-btn-dark" : "btn-line st-btn-dark"}" href="email-coach.html${ready ? "?from=level" : ""}" data-st-email>Open Email Coach</a>`);
  }
  function drawPicks() {
    const box = document.getElementById("stPicks");
    if (!box || !programs || !P || !L) return;
    const st = homeState(), bands = sum.bands, label = bands.map(b => L.BAND_LABELS[b]).join(" and ");
    const r = P.pick(programs, bands, st);
    const opts = L.STATE_NAMES.map(n => `<option${n === st ? " selected" : ""}>${esc(n)}</option>`).join("");
    box.innerHTML = `<label class="st-state"><span>Your home state</span><select id="stState"><option value="">Choose a state</option>${opts}</select></label>
      ${!st ? `<p class="st-meta">Choose your state to see ${esc(label)} programs near you.</p>`
        : r.list.length ? `<ul class="st-list">${r.list.map(p => `<li><div><a href="colleges.html#school=${encodeURIComponent(p.slug)}">${esc(p.name)}</a><span>${esc(L.BAND_LABELS[p.band] || p.level)}, ${esc(p.state)}</span></div><a class="st-email" href="email-coach.html?from=level&school=${encodeURIComponent(p.slug)}" data-st-email data-track="college_email_click">Email coach</a></li>`).join("")}</ul>`
        : `<p class="st-meta">No ${esc(label)} programs in or next to ${esc(st)}.</p>`}
      <p class="st-meta">${st && r.list.length ? "Picked by level and distance from home, not by how you'd fit a program. " : ""}<a href="colleges.html?bands=${encodeURIComponent(bands.join(","))}&from=fml">See every ${esc(label)} program</a></p>`;
    document.getElementById("stState").addEventListener("change", e => { try { localStorage.setItem((P && P.STATE_KEY) || "psr_home_state", e.target.value); } catch (_) {} drawPicks(); const s = document.getElementById("stState"); if (s) s.focus(); });
  }
  function render() {
    root.innerHTML = `<ol class="st-steps">${step1()}${step2()}${step3()}</ol>`;
    if (sum && sum.bands && sum.bands.length) {
      if (programs) drawPicks();
      else fetch("data/programs.json").then(r => r.json()).then(d => { programs = d.programs.map(p => Object.assign({ band: L.bandOf(p) }, p)); drawPicks(); })
        .catch(() => { const b = document.getElementById("stPicks"); if (b) b.innerHTML = `<p class="st-meta">The school list couldn't load. <a href="colleges.html">Open College Finder</a>.</p>`; });
    }
  }
  render();
  // Signed in on a new device: bring the latest result over from the account.
  if (window.PSRLevelSync) window.PSRLevelSync.sync().then(s => { if (s && (!sum || s.t !== sum.t)) { sum = s; render(); } }).catch(() => {});
  // Carry the player's numbers into Email Coach, the same way Find My Level does.
  root.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("[data-st-email]");
    if (a && sum && sum.handoff) { try { sessionStorage.setItem("psr_email_handoff_v2", JSON.stringify(Object.assign({}, sum.handoff, { created_at: new Date().toISOString() }))); } catch (_) {} }
  });
})();
