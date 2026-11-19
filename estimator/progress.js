/*
  Find My Level: progress history (v17). Saved only on this device (localStorage); no account,
  nothing uploaded. Pure helpers plus a tiny storage wrapper so Node tests can pass a fake store.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.PSRLevelProgress = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "psr_fml_history_v1", MAX = 20;
  const TRACKED = [["maxFb", "max fastball", "mph"], ["typFb", "game fastball", "mph"], ["fbSpin", "fastball spin", "rpm"], ["maxEv", "max exit velocity", "mph"],
    ["sixty", "60-yard", "s"], ["ifVelo", "infield arm", "mph"], ["ofVelo", "outfield arm", "mph"], ["cVelo", "catcher arm", "mph"], ["pop", "pop time", "s"],
    ["bbSpin", "breaking-ball spin", "rpm"], ["batSpeed", "bat speed", "mph"], ["avgEv", "average exit velocity", "mph"]];
  const LOWER_BETTER = new Set(["sixty", "pop"]);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${MON[d.getMonth()]} ${d.getFullYear()}`; };

  function entryFrom(input, levelKeys, now) {
    const m = input.metrics || {}, metrics = {};
    TRACKED.forEach(([k]) => { if (typeof m[k] === "number" && isFinite(m[k])) metrics[k] = m[k]; });
    return { t: (now || new Date()).toISOString(), gradYear: input.gradYear || null, primary: input.primary || "", secondary: input.secondary || "",
      throws: input.throws || "", bats: input.bats || "", metrics, levels: levelKeys || [] };
  }
  const same = (a, b) => a && b && a.primary === b.primary && a.secondary === b.secondary && JSON.stringify(a.metrics) === JSON.stringify(b.metrics);

  function load(store) { try { const v = JSON.parse(store.getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter(e => e && e.t && e.metrics) : []; } catch (e) { return []; } }
  function save(store, entry) {
    const h = load(store);
    if (same(h[h.length - 1], entry)) h[h.length - 1] = Object.assign({}, h[h.length - 1], { t: entry.t, levels: entry.levels, gradYear: entry.gradYear });
    else h.push(entry);
    try { store.setItem(KEY, JSON.stringify(h.slice(-MAX))); } catch (e) {}
    return h.slice(-MAX);
  }
  function clear(store) { try { store.removeItem(KEY); } catch (e) {} }

  // Changes between the current entry and the most recent earlier entry for the same primary position.
  function deltas(history, current) {
    const prev = history.slice().reverse().find(e => e.t !== current.t && e.primary === current.primary);
    if (!prev) return null;
    const since = monthLabel(prev.t), out = [];
    TRACKED.forEach(([k, label, unit]) => {
      const a = prev.metrics[k], b = current.metrics[k];
      if (typeof a !== "number" || typeof b !== "number") return;
      const d = unit === "s" ? Math.round((b - a) * 100) / 100 : unit === "rpm" ? Math.round(b - a) : Math.round((b - a) * 10) / 10;
      if (d === 0) { out.push({ key: k, diff: 0, better: null, text: `Same ${label} as ${since}` }); return; }
      const better = LOWER_BETTER.has(k) ? d < 0 : d > 0;
      const num = unit === "s" ? `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(2)} s` : `${d > 0 ? "+" : "−"}${Math.abs(d)} ${unit}`;
      out.push({ key: k, diff: d, better, text: `${num} ${label} since ${since}` });
    });
    return { since, prev, items: out };
  }
  // Values of one metric over saved entries for the same primary position (oldest first), for a sparkline.
  function series(history, primary, key) {
    return history.filter(e => e.primary === primary && typeof e.metrics[key] === "number").map(e => ({ t: e.t, v: e.metrics[key] }));
  }
  // Small inline SVG line; no axes, no projection. Needs at least 2 points.
  function sparkline(points, w, h) {
    w = w || 84; h = h || 24;
    if (!points || points.length < 2) return "";
    const vs = points.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
    const xy = points.map((p, i) => [Math.round((i / (points.length - 1)) * (w - 4) + 2), Math.round(h - 3 - ((p.v - lo) / span) * (h - 6))]);
    const last = xy[xy.length - 1];
    return `<svg class="lvl-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${xy.map(p => p.join(",")).join(" ")}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="currentColor"/></svg>`;
  }
  return { KEY, TRACKED, entryFrom, load, save, clear, deltas, series, sparkline, monthLabel };
});
