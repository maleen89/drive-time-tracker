import { getLocalTimeMinutes, parseTimeLocal, DEFAULT_TIMEZONE } from "@/lib/time";

export type CommuteDirection = "to_work" | "from_work";
export type CommutePeriod = "morning" | "afternoon";

const MORNING_START = 7 * 60;
const MORNING_END = 10 * 60;
const AFTERNOON_START = 14 * 60;
const AFTERNOON_END = 18 * 60;

export function getCommutePeriodFromMinutes(minutes: number): CommutePeriod | null {
  if (minutes >= MORNING_START && minutes <= MORNING_END) {
    return "morning";
  }
  if (minutes >= AFTERNOON_START && minutes <= AFTERNOON_END) {
    return "afternoon";
  }
  return null;
}

export function getCommutePeriodForSlotTime(timeLocal: string): CommutePeriod | null {
  const parsed = parseTimeLocal(timeLocal);
  if (!parsed) return null;
  return getCommutePeriodFromMinutes(parsed.hours * 60 + parsed.minutes);
}

export function getCommutePeriodNow(
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
): CommutePeriod | null {
  return getCommutePeriodFromMinutes(getLocalTimeMinutes(now, timeZone));
}

export function directionForPeriod(period: CommutePeriod): CommuteDirection {
  return period === "morning" ? "to_work" : "from_work";
}

export function pairRunsInPeriod(
  commuteDirection: string,
  period: CommutePeriod | null,
): boolean {
  if (!period) return false;
  return commuteDirection === directionForPeriod(period);
}

export function formatCommuteDirection(value: string): string {
  return value === "from_work" ? "Work → Home" : "Home → Work";
}

export function formatCommutePeriod(value: CommutePeriod | null): string {
  if (value === "morning") return "Morning (home → work)";
  if (value === "afternoon") return "Afternoon (work → home)";
  return "Outside commute hours";
}
