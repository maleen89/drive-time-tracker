export const DEFAULT_TIMEZONE =
  process.env.DEFAULT_TIMEZONE ?? "America/Los_Angeles";

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

export function parseDaysOfWeek(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
}

export const DEFAULT_WEEKDAYS = "1,2,3,4,5";

export function formatDaysOfWeek(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function formatDaysOfWeekLabel(daysOfWeek: string): string {
  const days = parseDaysOfWeek(daysOfWeek);
  if (days.length === 0) return "—";
  if (days.length === 7) return "Every day";
  if (days.join(",") === "1,2,3,4,5") return "Mon–Fri";
  if (days.join(",") === "6,7") return "Sat–Sun";
  return days
    .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return "—";
  const miles = meters / 1609.344;
  return `${miles.toFixed(1)} mi`;
}

export function parseTimeLocal(value: string): { hours: number; minutes: number } | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function formatTimeLocal(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    weekday: weekdayMap[lookup.weekday] ?? 1,
  };
}

export function getIsoWeekday(date: Date, timeZone: string): number {
  return getZonedParts(date, timeZone).weekday;
}

export function addDaysInTimeZone(date: Date, days: number, timeZone: string): ZonedParts {
  const parts = getZonedParts(date, timeZone);
  const anchor = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 12, 0, timeZone);
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return getZonedParts(shifted, timeZone);
}

export function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getLocalTimeMinutes(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

  for (let offsetHours = -16; offsetHours <= 16; offsetHours += 1) {
    const candidate = new Date(utcGuess.getTime() + offsetHours * 60 * 60 * 1000);
    const parts = getZonedParts(candidate, timeZone);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hours &&
      parts.minute === minutes
    ) {
      return candidate;
    }
  }

  return utcGuess;
}

export function buildScheduledDepartureAt(
  now: Date,
  timeLocal: string,
  timeZone: string,
): Date | null {
  const parsed = parseTimeLocal(timeLocal);
  if (!parsed) return null;

  const parts = getZonedParts(now, timeZone);
  return zonedDateTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    parsed.hours,
    parsed.minutes,
    timeZone,
  );
}

export function slotMatchesNow(
  now: Date,
  timeLocal: string,
  daysOfWeek: string,
  timeZone: string,
  toleranceMinutes = 5,
): boolean {
  const parsed = parseTimeLocal(timeLocal);
  if (!parsed) return false;

  const allowedDays = parseDaysOfWeek(daysOfWeek);
  const weekday = getIsoWeekday(now, timeZone);
  if (!allowedDays.includes(weekday)) return false;

  const nowMinutes = getLocalTimeMinutes(now, timeZone);
  const slotMinutes = parsed.hours * 60 + parsed.minutes;
  const minutesAfterSlot = nowMinutes - slotMinutes;
  // Match at the scheduled departure time or shortly after (never before).
  // With a 5-minute poll interval, a 14:00 slot runs on the 14:00 or 14:05 check.
  return minutesAfterSlot >= 0 && minutesAfterSlot <= toleranceMinutes;
}

export function formatDateTime(value: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
