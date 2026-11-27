const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact age of a unix-seconds timestamp: "now", "5m", "3h", "2d", "4w", then a date. */
export function relativeTime(timestampSec: number, nowMs: number = Date.now()): string {
  const age = Math.max(0, Math.floor(nowMs / 1000 - timestampSec));
  if (age < MINUTE) return 'now';
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h`;
  if (age < WEEK) return `${Math.floor(age / DAY)}d`;
  if (age < 5 * WEEK) return `${Math.floor(age / WEEK)}w`;
  const date = new Date(timestampSec * 1000);
  const sameYear = date.getFullYear() === new Date(nowMs).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
