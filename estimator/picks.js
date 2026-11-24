/*
  Find My Level: "Schools to start with".
  After a result, lists a few college programs at the player's level, closest to home first,
  each with an "Email coach" button that opens Email Coach with the player's metrics and that school.
  Selection is by level and location only. It is not a rating of fit for any school.
  Reads the public directory (data/programs.json). Nothing about the player is sent anywhere;
  the chosen home state is kept in this browser only.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../recruiting/logic.js"));
  else root.PSRPicks = factory(root.PSRLogic);
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";

  const COUNT = 6;
  const STATE_KEY = "psr_home_state";
  // Bordering states (by postal code), used to fill the list when the home state has few programs.
  const NEAR = {
    AL: "FL GA MS TN", AK: "WA", AZ: "CA NV UT NM CO", AR: "LA MS TN MO OK TX", CA: "OR NV AZ",
    CO: "WY NE KS OK NM AZ UT", CT: "NY MA RI", DE: "MD PA NJ", DC: "MD VA", FL: "GA AL",
    GA: "FL AL TN NC SC", HI: "CA", ID: "WA OR NV UT WY MT", IL: "WI IA MO KY IN", IN: "IL MI OH KY",
    IA: "MN WI IL MO NE SD", KS: "NE MO OK CO", KY: "IN OH WV VA TN MO IL", LA: "TX AR MS",
    ME: "NH MA", MD: "PA DE VA WV DC", MA: "RI CT NY VT NH", MI: "OH IN WI", MN: "WI IA SD ND",
    MS: "LA AR TN AL", MO: "IA IL KY TN AR OK KS NE", MT: "ID WY SD ND", NE: "SD IA MO KS CO WY",
    NV: "CA OR ID UT AZ", NH: "ME MA VT", NJ: "NY PA DE", NM: "AZ UT CO OK TX", NY: "PA NJ CT MA VT",
    NC: "VA TN GA SC", ND: "MN SD MT", OH: "PA WV KY IN MI", OK: "KS MO AR TX NM CO", OR: "WA ID NV CA",
    PA: "NY NJ DE MD WV OH", PR: "FL", RI: "CT MA", SC: "NC GA", SD: "ND MN IA NE WY MT",
    TN: "KY VA NC GA AL MS AR MO", TX: "NM OK AR LA", UT: "ID WY CO NM AZ NV", VT: "NY NH MA",
    VA: "MD DC WV KY TN NC", WA: "ID OR", WV: "OH PA MD VA KY", WI: "MI MN IA IL", WY: "MT SD NE CO UT ID"
  };
  const CODE = Object.fromEntries(Object.entries(L.STATES).map(([c, n]) => [n, c]));

  function nearNames(stateName) {
    const c = CODE[stateName];
    return new Set(((c && NEAR[c]) || "").split(" ").filter(Boolean).map(x => L.STATES[x]).filter(Boolean));
  }

  // Home state first, then bordering states. Within each, the player's level before the next one down, then A to Z.
  // Programs farther away are left to the College Finder link.
  function pick(programs, bands, homeState, n) {
    n = n || COUNT;
    if (!homeState || !bands || !bands.length) return { list: [], total: 0 };
    const near = nearNames(homeState);
    const pool = programs.filter(p => p.record_status !== "hidden" && bands.includes(p.band || L.bandOf(p)));
    const tier = p => p.state === homeState ? 0 : near.has(p.state) ? 1 : 2;
    const list = pool.filter(p => tier(p) < 2).sort((a, b) =>
      tier(a) - tier(b) || bands.indexOf(a.band || L.bandOf(a)) - bands.indexOf(b.band || L.bandOf(b)) || a.name.localeCompare(b.name)
    ).slice(0, n);
    return { list, total: pool.filter(p => tier(p) < 2).length, inState: pool.filter(p => tier(p) === 0).length };
  }

  return { pick, nearNames, COUNT, STATE_KEY };
});
