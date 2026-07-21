import { getCommuteDirection, homeLocation } from "@/lib/tracked-pairs";
import { formatDateTime, formatDistance, formatDuration, DEFAULT_TIMEZONE } from "@/lib/time";

type MeasurementSummary = {
  id: string;
  createdAt: Date;
  durationInTrafficSeconds: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
};

type PairWithMeasurements = {
  id: string;
  active: boolean;
  originLocation: { id: string; label: string; address: string; isWork: boolean };
  destinationLocation: { id: string; label: string; address: string; isWork: boolean };
  measurements: MeasurementSummary[];
};

export interface HomeCommuteRow {
  homeId: string;
  homeAddress: string;
  homeLabel: string;
  morning: MeasurementSummary | null;
  evening: MeasurementSummary | null;
  distanceMeters: number | null;
}

export function buildHomeCommuteRows(pairs: PairWithMeasurements[]): HomeCommuteRow[] {
  const toWorkPairs = pairs.filter((pair) => getCommuteDirection(pair) === "to_work");
  const fromWorkPairs = pairs.filter((pair) => getCommuteDirection(pair) === "from_work");

  return toWorkPairs
    .flatMap((morningPair) => {
      const home = homeLocation(morningPair);
      if (!home) return [];

      const eveningPair = fromWorkPairs.find(
        (pair) => homeLocation(pair)?.id === home.id,
      );

      const morning = morningPair.measurements[0] ?? null;
      const evening = eveningPair?.measurements[0] ?? null;

      return [
        {
          homeId: home.id,
          homeAddress: home.address,
          homeLabel: home.label,
          morning,
          evening,
          distanceMeters: morning?.distanceMeters ?? evening?.distanceMeters ?? null,
        },
      ];
    })
    .sort((a, b) => {
      const aDistance = a.distanceMeters ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (aDistance !== bDistance) return aDistance - bDistance;
      return a.homeLabel.localeCompare(b.homeLabel);
    });
}

export function formatMeasurementDuration(measurement: MeasurementSummary | null): string {
  if (!measurement) return "—";
  return formatDuration(measurement.durationInTrafficSeconds ?? measurement.durationSeconds);
}

export function formatMeasurementTooltip(measurement: MeasurementSummary | null): string | undefined {
  if (!measurement) return undefined;
  return `Last measured ${formatDateTime(measurement.createdAt, DEFAULT_TIMEZONE)}`;
}

export function formatRowDistance(distanceMeters: number | null): string {
  return formatDistance(distanceMeters);
}
