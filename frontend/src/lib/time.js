// Dates from the API are plain "YYYY-MM-DD" strings in Asia/Kolkata; treat them as UTC midnights so
// formatting never shifts a day.
const DAY_MS = 86400000;
export const TZ = "Asia/Kolkata";

export function parseDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDate(iso, options) {
  return parseDate(iso).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseDate(toIso) - parseDate(fromIso)) / DAY_MS);
}

// "Week 1 · Nov 2–6" → { label: "Week 1", dates: "Nov 2–6", n: 1 }
export function splitWeekName(name = "") {
  const [label, dates = ""] = name.split(" · ");
  const n = Number(label.replace(/\D/g, "")) || null;
  return { label, dates, n };
}

// Block times read like "12:30–2:00"; the study blocks run in the afternoon, so hours before 8 are PM.
export function parseBlockTime(text) {
  const match = text.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const toMinutes = (h, m) => {
    let hour = Number(h);
    if (hour < 8) hour += 12;
    return hour * 60 + Number(m);
  };
  return { start: toMinutes(match[1], match[2]), end: toMinutes(match[3], match[4]) };
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

// Minutes since midnight right now in Asia/Kolkata.
export function nowMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
