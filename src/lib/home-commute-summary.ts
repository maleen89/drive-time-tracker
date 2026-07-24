import { getCommuteDirection, homeLocation } from "@/lib/tracked-pairs";
import {
  addDaysInTimeZone,
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatDistance,
  formatDuration,
  getLocalDateKey,
  getZonedParts,
  parseTimeLocal,
  zonedDateTimeToUtc,
} from "@/lib/time";

export type CommuteDirectionFilter = "morning" | "evening";

export const SUMMARY_WEEKDAY_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export const SUMMARY_WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export type SummaryMeasurement = {
  id: string;
  scheduledDepartureAt: string;
  durationInTrafficSeconds: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  timeLocal: string | null;
  direction: CommuteDirectionFilter;
};

export type SummaryRow = {
  homeId: string;
  homeAddress: string;
  homeLabel: string;
  distanceMeters: number | null;
  measurements: SummaryMeasurement[];
};

export type SummaryTimeOption = {
  key: string;
  direction: CommuteDirectionFilter;
  timeLocal: string;
  label: string;
};

export type SummaryWeekOption = {
  key: string;
  label: string;
};

type MeasurementRecord = {
  id: string;
  scheduledDepartureAt: Date;
  durationInTrafficSeconds: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  pairScheduleSlot: { timeLocal: string } | null;
};

type PairWithMeasurements = {
  id: string;
  active: boolean;
  originLocation: { id: string; label: string; address: string; isWork: boolean };
  destinationLocation: { id: string; label: string; address: string; isWork: boolean };
  measurements: MeasurementRecord[];
};

function binMinutesToTen(minute: number): number {
  return Math.floor(minute / 10) * 10;
}

export function binTimeLocalToTenMinutes(timeLocal: string): string {
  const parsed = parseTimeLocal(timeLocal);
  if (!parsed) return timeLocal;
  return `${String(parsed.hours).padStart(2, "0")}:${String(binMinutesToTen(parsed.minutes)).padStart(2, "0")}`;
}

export function getMeasurementBinnedTime(measurement: SummaryMeasurement): string {
  const parts = getZonedParts(new Date(measurement.scheduledDepartureAt), DEFAULT_TIMEZONE);
  return `${String(parts.hour).padStart(2, "0")}:${String(binMinutesToTen(parts.minute)).padStart(2, "0")}`;
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function getWeekMondayDateKey(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const parts = getZonedParts(date, timeZone);
  const mondayParts = addDaysInTimeZone(date, -(parts.weekday - 1), timeZone);
  return dateKeyFromParts(mondayParts.year, mondayParts.month, mondayParts.day);
}

export function getWeekDayDateKeys(mondayDateKey: string, timeZone = DEFAULT_TIMEZONE): string[] {
  const parsed = parseDateKey(mondayDateKey);
  if (!parsed) return [];

  const mondayAnchor = zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 12, 0, timeZone);

  return Array.from({ length: 6 }, (_, offset) => {
    const parts = addDaysInTimeZone(mondayAnchor, offset, timeZone);
    return dateKeyFromParts(parts.year, parts.month, parts.day);
  });
}

function formatShortDateFromKey(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return `${parsed.month}/${parsed.day}`;
}

export function formatWeekRangeLabel(mondayDateKey: string): string {
  const dayKeys = getWeekDayDateKeys(mondayDateKey);
  if (dayKeys.length === 0) return mondayDateKey;

  const monday = formatShortDateFromKey(dayKeys[0]!);
  const saturday = formatShortDateFromKey(dayKeys[dayKeys.length - 1]!);
  const mondayParsed = parseDateKey(dayKeys[0]!);
  const monthName = mondayParsed
    ? new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        zonedDateTimeToUtc(mondayParsed.year, mondayParsed.month, 1, 12, 0, DEFAULT_TIMEZONE),
      )
    : "";

  return `${monthName} ${monday}–${saturday}`;
}

export function formatWeekDayColumnHeader(dateKey: string): { weekday: string; dateLine: string } {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return { weekday: "—", dateLine: dateKey };
  }

  const parts = getZonedParts(
    zonedDateTimeToUtc(parsed.year, parsed.month, parsed.day, 12, 0, DEFAULT_TIMEZONE),
    DEFAULT_TIMEZONE,
  );

  return {
    weekday: SUMMARY_WEEKDAY_LABELS[parts.weekday] ?? "—",
    dateLine: formatShortDateFromKey(dateKey),
  };
}

function toSummaryMeasurement(
  measurement: MeasurementRecord,
  direction: CommuteDirectionFilter,
): SummaryMeasurement {
  return {
    id: measurement.id,
    scheduledDepartureAt: measurement.scheduledDepartureAt.toISOString(),
    durationInTrafficSeconds: measurement.durationInTrafficSeconds,
    durationSeconds: measurement.durationSeconds,
    distanceMeters: measurement.distanceMeters,
    timeLocal: measurement.pairScheduleSlot?.timeLocal ?? null,
    direction,
  };
}

export function buildSummaryRows(pairs: PairWithMeasurements[]): SummaryRow[] {
  const toWorkPairs = pairs.filter((pair) => getCommuteDirection(pair) === "to_work");
  const fromWorkPairs = pairs.filter((pair) => getCommuteDirection(pair) === "from_work");

  return toWorkPairs
    .flatMap((morningPair) => {
      const home = homeLocation(morningPair);
      if (!home) return [];

      const eveningPair = fromWorkPairs.find(
        (pair) => homeLocation(pair)?.id === home.id,
      );

      const measurements: SummaryMeasurement[] = [
        ...morningPair.measurements.map((measurement) =>
          toSummaryMeasurement(measurement, "morning"),
        ),
        ...(eveningPair?.measurements ?? []).map((measurement) =>
          toSummaryMeasurement(measurement, "evening"),
        ),
      ].sort(
        (a, b) =>
          new Date(b.scheduledDepartureAt).getTime() -
          new Date(a.scheduledDepartureAt).getTime(),
      );

      const latestMorning = measurements.find((entry) => entry.direction === "morning") ?? null;
      const latestEvening = measurements.find((entry) => entry.direction === "evening") ?? null;

      return [
        {
          homeId: home.id,
          homeAddress: home.address,
          homeLabel: home.label,
          distanceMeters:
            latestMorning?.distanceMeters ?? latestEvening?.distanceMeters ?? null,
          measurements,
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

export function buildMeasurementLookupKey(
  homeId: string,
  dateKey: string,
  direction: CommuteDirectionFilter,
  binnedTimeLocal: string,
): string {
  return `${homeId}:${dateKey}:${direction}:${binnedTimeLocal}`;
}

export function buildMeasurementLookup(rows: SummaryRow[]): Map<string, SummaryMeasurement> {
  const lookup = new Map<string, SummaryMeasurement>();

  for (const row of rows) {
    for (const measurement of row.measurements) {
      const dateKey = getLocalDateKey(new Date(measurement.scheduledDepartureAt), DEFAULT_TIMEZONE);
      const binnedTime = getMeasurementBinnedTime(measurement);
      lookup.set(
        buildMeasurementLookupKey(row.homeId, dateKey, measurement.direction, binnedTime),
        measurement,
      );
    }
  }

  return lookup;
}

export function findMeasurementInLookup(
  lookup: Map<string, SummaryMeasurement>,
  row: SummaryRow,
  dateKey: string,
  direction: CommuteDirectionFilter,
  binnedTimeLocal: string,
): SummaryMeasurement | null {
  return lookup.get(buildMeasurementLookupKey(row.homeId, dateKey, direction, binnedTimeLocal)) ?? null;
}

export function buildTimeOptionKey(
  direction: CommuteDirectionFilter,
  timeLocal: string,
): string {
  return `${direction}:${binTimeLocalToTenMinutes(timeLocal)}`;
}

export function parseTimeOptionKey(key: string): { direction: CommuteDirectionFilter; timeLocal: string } | null {
  const separator = key.indexOf(":");
  if (separator === -1) return null;

  const direction = key.slice(0, separator);
  const timeLocal = key.slice(separator + 1);
  if ((direction !== "morning" && direction !== "evening") || !timeLocal) {
    return null;
  }
  return { direction, timeLocal: binTimeLocalToTenMinutes(timeLocal) };
}

export function collectAvailableTimeOptions(rows: SummaryRow[]): SummaryTimeOption[] {
  const seen = new Set<string>();
  const options: SummaryTimeOption[] = [];

  for (const row of rows) {
    for (const measurement of row.measurements) {
      const binnedTime = getMeasurementBinnedTime(measurement);
      const key = buildTimeOptionKey(measurement.direction, binnedTime);
      if (seen.has(key)) continue;
      seen.add(key);

      const directionLabel = measurement.direction === "morning" ? "AM" : "PM";
      options.push({
        key,
        direction: measurement.direction,
        timeLocal: binnedTime,
        label: `${binnedTime} (${directionLabel})`,
      });
    }
  }

  return options.sort((a, b) => {
    if (a.direction !== b.direction) {
      return a.direction === "morning" ? -1 : 1;
    }
    return a.timeLocal.localeCompare(b.timeLocal);
  });
}

export function collectAvailableWeekOptions(rows: SummaryRow[]): SummaryWeekOption[] {
  const seen = new Set<string>();

  for (const row of rows) {
    for (const measurement of row.measurements) {
      seen.add(getWeekMondayDateKey(new Date(measurement.scheduledDepartureAt)));
    }
  }

  seen.add(getWeekMondayDateKey(new Date()));

  return [...seen]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      key,
      label: formatWeekRangeLabel(key),
    }));
}

export function pickDefaultTimeKey(rows: SummaryRow[]): string {
  const options = collectAvailableTimeOptions(rows);
  if (options.length === 0) return "";

  const morning = options.find((option) => option.direction === "morning");
  return morning?.key ?? options[0]!.key;
}

export function pickDefaultWeekKey(rows: SummaryRow[]): string {
  const options = collectAvailableWeekOptions(rows);
  return options[0]?.key ?? getWeekMondayDateKey(new Date());
}

export function formatMeasurementDuration(measurement: SummaryMeasurement | null): string {
  if (!measurement) return "—";
  return formatDuration(measurement.durationInTrafficSeconds ?? measurement.durationSeconds);
}

export function formatMeasurementTooltip(measurement: SummaryMeasurement | null): string | undefined {
  if (!measurement) return undefined;
  return `Recorded ${formatDateTime(measurement.scheduledDepartureAt, DEFAULT_TIMEZONE)}`;
}

export function formatRowDistance(distanceMeters: number | null): string {
  return formatDistance(distanceMeters);
}
