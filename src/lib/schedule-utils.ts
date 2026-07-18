import {
  formatCommutePeriod,
  getCommutePeriodForSlotTime,
  type CommutePeriod,
} from "@/lib/commute";
import { getCommuteDirection, pairLabel } from "@/lib/tracked-pairs";
import {
  addDaysInTimeZone,
  DEFAULT_TIMEZONE,
  formatDateTime,
  getZonedParts,
  parseDaysOfWeek,
  parseTimeLocal,
  slotMatchesNow,
  zonedDateTimeToUtc,
} from "@/lib/time";

export interface ScheduleSlotInput {
  timeLocal: string;
  daysOfWeek: string;
  timezone: string;
  active: boolean;
  trackedPairId: string;
  pairLabel: string;
  commutePeriod: CommutePeriod | null;
}

export interface NextScheduleRun {
  nextRunAt: string;
  slotTimeLocal: string;
  pairLabel: string;
  timezone: string;
  inWindow: boolean;
  activeSlotTimeLocal: string | null;
  activePairLabel: string | null;
  commutePeriod: CommutePeriod | null;
}

export function getNextScheduleRun(
  slots: ScheduleSlotInput[],
  now = new Date(),
  toleranceMinutes = 5,
): NextScheduleRun | null {
  const activeSlots = slots.filter((slot) => slot.active);
  if (activeSlots.length === 0) return null;

  let inWindow = false;
  let activeSlotTimeLocal: string | null = null;
  let activePairLabel: string | null = null;

  for (const slot of activeSlots) {
    const timeZone = slot.timezone || DEFAULT_TIMEZONE;
    if (slotMatchesNow(now, slot.timeLocal, slot.daysOfWeek, timeZone, toleranceMinutes)) {
      inWindow = true;
      activeSlotTimeLocal = slot.timeLocal;
      activePairLabel = slot.pairLabel;
      break;
    }
  }

  let best: { at: Date; slot: ScheduleSlotInput } | null = null;

  for (const slot of activeSlots) {
    const timeZone = slot.timezone || DEFAULT_TIMEZONE;
    const parsed = parseTimeLocal(slot.timeLocal);
    if (!parsed) continue;

    const allowedDays = parseDaysOfWeek(slot.daysOfWeek);

    for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
      const dayParts =
        dayOffset === 0
          ? getZonedParts(now, timeZone)
          : addDaysInTimeZone(now, dayOffset, timeZone);

      if (!allowedDays.includes(dayParts.weekday)) continue;

      const runAt = zonedDateTimeToUtc(
        dayParts.year,
        dayParts.month,
        dayParts.day,
        parsed.hours,
        parsed.minutes,
        timeZone,
      );

      if (runAt.getTime() <= now.getTime()) continue;

      if (!best || runAt.getTime() < best.at.getTime()) {
        best = { at: runAt, slot };
      }
    }
  }

  if (!best) return null;

  return {
    nextRunAt: best.at.toISOString(),
    slotTimeLocal: best.slot.timeLocal,
    pairLabel: best.slot.pairLabel,
    timezone: best.slot.timezone || DEFAULT_TIMEZONE,
    inWindow,
    activeSlotTimeLocal,
    activePairLabel,
    commutePeriod:
      best.slot.commutePeriod ?? getCommutePeriodForSlotTime(best.slot.timeLocal),
  };
}

export function buildScheduleInputs(
  pairs: Array<{
    id: string;
    active: boolean;
    originLocation: { id: string; label: string; address: string; isWork: boolean };
    destinationLocation: { id: string; label: string; address: string; isWork: boolean };
    scheduleSlots: Array<{
      timeLocal: string;
      daysOfWeek: string;
      timezone: string;
      active: boolean;
    }>;
  }>,
): ScheduleSlotInput[] {
  return pairs.flatMap((pair) => {
    if (!pair.active) return [];
    const direction = getCommuteDirection(pair);
    const label = pairLabel(pair);
    const commutePeriod =
      direction === "to_work"
        ? ("morning" as const)
        : direction === "from_work"
          ? ("afternoon" as const)
          : getCommutePeriodForSlotTime("07:00");

    return pair.scheduleSlots.map((slot) => ({
      trackedPairId: pair.id,
      pairLabel: label,
      timeLocal: slot.timeLocal,
      daysOfWeek: slot.daysOfWeek,
      timezone: slot.timezone,
      active: slot.active,
      commutePeriod: getCommutePeriodForSlotTime(slot.timeLocal) ?? commutePeriod,
    }));
  });
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

export function formatNextRunLabel(next: NextScheduleRun): string {
  const when = formatDateTime(next.nextRunAt, next.timezone);
  const period = formatCommutePeriod(next.commutePeriod);
  return `${when} — ${next.pairLabel} (${next.slotTimeLocal}) · ${period}`;
}
