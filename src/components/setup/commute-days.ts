import type { TrackedPairData } from "@/components/setup/types";
import type { CommuteRouteGroup } from "@/lib/tracked-pairs";
import { DEFAULT_WEEKDAYS, parseDaysOfWeek } from "@/lib/time";

export function getPairWeekdays(pair: TrackedPairData): number[] {
  const slot = pair.scheduleSlots.find((entry) => entry.active) ?? pair.scheduleSlots[0];
  return parseDaysOfWeek(slot?.daysOfWeek ?? DEFAULT_WEEKDAYS);
}

export function getCommuteWeekdays(group: CommuteRouteGroup<TrackedPairData>): number[] {
  const pair = group.toWorkPair ?? group.fromWorkPair;
  return pair ? getPairWeekdays(pair) : parseDaysOfWeek(DEFAULT_WEEKDAYS);
}
