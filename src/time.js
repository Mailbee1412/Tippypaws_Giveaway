const DEFAULT_TZ = process.env.TIMEZONE || "Asia/Bangkok";

function getTimeZoneOffset(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf
    .formatToParts(date)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

/**
 * Parse a wall-clock date/time string in a given IANA timezone.
 * Accepts "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm".
 * Returns a JS Date (UTC instant), or null if invalid.
 */
export function parseEndTime(input, timeZone = DEFAULT_TZ) {
  if (!input) return null;
  const normalized = input.trim().replace("T", " ");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/
  );
  if (!match) return null;

  const [, y, mo, d, h, mi] = match.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = getTimeZoneOffset(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

export function formatInZone(date, timeZone = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(ms) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const parts = [];
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  if (secs && !days) parts.push(`${secs}s`);
  return parts.join(" ") || "0s";
}

export const TIMEZONE = DEFAULT_TZ;
