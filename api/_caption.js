// Reads a Peach State feature caption and pulls out the player's details.
// Expected first line (the same format as the cover header):
//   Clark Chase | 1B/LHP | 2029 | 6'4 | 220 | Centreville High School
//   ⚽ Luca Bocchini | CAM | W | 2031 | 5'8 | 138 | Roswell Santos MLS NEXT
// Everything after the first line becomes the scouting write-up (hashtags and @tags at the end are dropped).

const YEAR = /^(19|20)\d{2}$/;
const HEIGHT = /^\d\s*['’′]\s*\d{1,2}\s*(["”″]|'')?$/;
const WEIGHT = /^\d{2,3}\s*(lb|lbs)?$/i;

function clean(s) {
  return String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCaption(caption) {
  if (!caption) return null;
  const lines = String(caption).replace(/\r/g, "").split("\n");
  const firstIdx = lines.findIndex(l => l.includes("|"));
  if (firstIdx === -1) return null;
  const parts = lines[firstIdx].split("|").map(clean).filter(Boolean);
  const yi = parts.findIndex(p => YEAR.test(p));
  if (yi < 1) return null;                       // not a player feature

  const name = parts[0];
  const position = parts.slice(1, yi).join(" / ") || null;
  const gradYear = parseInt(parts[yi], 10);
  let height = null, weight = null;
  const rest = [];
  for (const p of parts.slice(yi + 1)) {
    if (!height && HEIGHT.test(p)) {
      height = p.replace(/\s/g, "").replace(/[’′]/g, "'").replace(/(["”″]|'')$/, '"');
      if (!height.endsWith('"')) height += '"';
    }
    else if (!weight && WEIGHT.test(p)) weight = p.replace(/\s*(lb|lbs)$/i, "") + " lb";
    else rest.push(p);
  }
  const org = rest.join(" | ") || null;
  // Clubs/travel teams are recognized by common words; anything else is treated as the high school.
  const isClub = org && /(mls|ecnl|\bfc\b|\bsc\b|club|travel|\b1\d\s?u\b|select|united|showcase|aau|7v7|national|elite)/i.test(org);
  const isSchool = org && !isClub;

  // Write-up: the remaining lines, without trailing hashtag/mention-only lines
  const body = lines.slice(firstIdx + 1).map(l => l.trim());
  while (body.length && (!body[body.length - 1] || /^([#@][^\s]+\s*)+$/.test(body[body.length - 1]))) body.pop();
  const report = body.join("\n").replace(/\n{3,}/g, "\n\n").trim() || null;

  return {
    name, position, gradYear, height, weight,
    school: isSchool ? org : null,
    team: isSchool ? null : org,
    report
  };
}

module.exports = { parseCaption };
