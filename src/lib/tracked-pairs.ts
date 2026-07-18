import type { CommuteDirection } from "@/lib/commute";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export type LocationRecord = {
  id: string;
  label: string;
  address: string;
  isWork: boolean;
};

export type TrackedPairWithLocations = {
  id: string;
  active: boolean;
  originLocation: LocationRecord;
  destinationLocation: LocationRecord;
};

export function getCommuteDirection(pair: TrackedPairWithLocations): CommuteDirection {
  if (pair.destinationLocation.isWork) return "to_work";
  if (pair.originLocation.isWork) return "from_work";
  return "to_work";
}

export function pairLabel(pair: TrackedPairWithLocations): string {
  return `${pair.originLocation.label} → ${pair.destinationLocation.label}`;
}

export function pairAddresses(pair: TrackedPairWithLocations): {
  originAddress: string;
  destinationAddress: string;
} {
  return {
    originAddress: pair.originLocation.address,
    destinationAddress: pair.destinationLocation.address,
  };
}

export function homeLocation(pair: TrackedPairWithLocations): LocationRecord | null {
  const direction = getCommuteDirection(pair);
  if (direction === "to_work") return pair.originLocation;
  if (direction === "from_work") return pair.destinationLocation;
  return null;
}

export const DEFAULT_MORNING_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00",
];

export const DEFAULT_AFTERNOON_SLOTS = [
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

export function defaultSlotsForDirection(direction: CommuteDirection): string[] {
  return direction === "to_work" ? DEFAULT_MORNING_SLOTS : DEFAULT_AFTERNOON_SLOTS;
}

export function defaultSlotsForPair(pair: TrackedPairWithLocations): string[] {
  return defaultSlotsForDirection(getCommuteDirection(pair));
}

export function formatSlotList(times: string[]): string {
  return [...times].sort().join(", ");
}

export type CommuteRouteGroup<T extends TrackedPairWithLocations = TrackedPairWithLocations> = {
  key: string;
  home: LocationRecord;
  work: LocationRecord;
  toWorkPair: T | null;
  fromWorkPair: T | null;
};

export function groupPairsIntoCommuteRoutes<T extends TrackedPairWithLocations>(
  pairs: T[],
  locations: LocationRecord[],
): CommuteRouteGroup<T>[] {
  const work = locations.find((location) => location.isWork);
  if (!work) return [];

  return locations
    .filter((location) => !location.isWork)
    .map((home) => ({
      key: home.id,
      home,
      work,
      toWorkPair:
        pairs.find(
          (pair) =>
            pair.originLocation.id === home.id &&
            pair.destinationLocation.id === work.id,
        ) ?? null,
      fromWorkPair:
        pairs.find(
          (pair) =>
            pair.originLocation.id === work.id &&
            pair.destinationLocation.id === home.id,
        ) ?? null,
    }))
    .filter((group) => group.toWorkPair || group.fromWorkPair);
}

export function getOrphanPairs<T extends { id: string }>(
  pairs: T[],
  groups: CommuteRouteGroup[],
): T[] {
  const groupedIds = new Set<string>();
  for (const group of groups) {
    if (group.toWorkPair) groupedIds.add(group.toWorkPair.id);
    if (group.fromWorkPair) groupedIds.add(group.fromWorkPair.id);
  }
  return pairs.filter((pair) => !groupedIds.has(pair.id));
}

export { DEFAULT_TIMEZONE };
