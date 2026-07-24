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
} from "@/lib/time";

export type CommuteDirectionFilter = "morning" | "evening";

export type SummaryColumn =
  | { id: string; kind: "latest"; direction: CommuteDirectionFilter }
  | { id: string; kind: "previous_day_same_slot"; direction: CommuteDirectionFilter }
  | {
      id: string;
      kind: "slot";
      direction: CommuteDirectionFilter;
      date: string;
      timeLocal: string;
    };

export const DEFAULT_SUMMARY_COLUMNS: SummaryColumn[] = [
  { id: "default-latest-morning", kind: "latest", direction: "morning" },
  { id: "default-prev-morning", kind: "previous_day_same_slot", direction: "morning" },
  { id: "default-latest-evening", kind: "latest", direction: "evening" },
  { id: "default-prev-evening", kind: "previous_day_same_slot", direction: "evening" },
];

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

export type SummaryColumnHeaderParts = {
  dateLine: string;
  timeLine: string | null;
};

export type SummarySlotOption = {
  key: string;
  direction: CommuteDirectionFilter;
  date: string;
  timeLocal: string;
  scheduledDepartureAt: string;
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

function formatDateLine(date: Date): string {
  const parts = getZonedParts(date, DEFAULT_TIMEZONE);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    weekday: "short",
  }).format(date);
  return `${weekday} ${parts.month}/${parts.day}`;
}

function formatDateLineFromKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return formatDateLine(anchor);
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

function measurementsForDirection(
  row: SummaryRow,
  direction: CommuteDirectionFilter,
): SummaryMeasurement[] {
  return row.measurements.filter((measurement) => measurement.direction === direction);
}

function findByDateAndBinnedSlot(
  measurements: SummaryMeasurement[],
  dateKey: string,
  binnedTimeLocal: string,
): SummaryMeasurement | null {
  return (
    measurements.find(
      (measurement) =>
        getMeasurementBinnedTime(measurement) === binnedTimeLocal &&
        getLocalDateKey(new Date(measurement.scheduledDepartureAt), DEFAULT_TIMEZONE) === dateKey,
    ) ?? null
  );
}

export function resolveSummaryColumnMeasurement(
  row: SummaryRow,
  column: SummaryColumn,
): SummaryMeasurement | null {
  const directionMeasurements = measurementsForDirection(row, column.direction);

  if (column.kind === "latest") {
    return directionMeasurements[0] ?? null;
  }

  if (column.kind === "previous_day_same_slot") {
    const latest = directionMeasurements[0];
    if (!latest) return null;

    const binnedTime = getMeasurementBinnedTime(latest);
    const previousDay = addDaysInTimeZone(new Date(latest.scheduledDepartureAt), -1, DEFAULT_TIMEZONE);
    const previousDateKey = `${previousDay.year}-${String(previousDay.month).padStart(2, "0")}-${String(previousDay.day).padStart(2, "0")}`;
    return findByDateAndBinnedSlot(directionMeasurements, previousDateKey, binnedTime);
  }

  return findByDateAndBinnedSlot(
    directionMeasurements,
    column.date,
    binTimeLocalToTenMinutes(column.timeLocal),
  );
}

function headerPartsFromMeasurement(measurement: SummaryMeasurement): SummaryColumnHeaderParts {
  return {
    dateLine: formatDateLine(new Date(measurement.scheduledDepartureAt)),
    timeLine: getMeasurementBinnedTime(measurement),
  };
}

function headerPartsFromDateAndTime(dateKey: string, timeLocal: string): SummaryColumnHeaderParts {
  return {
    dateLine: formatDateLineFromKey(dateKey),
    timeLine: binTimeLocalToTenMinutes(timeLocal),
  };
}

function getLeftColumnTimeLine(
  column: SummaryColumn,
  columns: SummaryColumn[],
  rows: SummaryRow[],
): string | null {
  const index = columns.findIndex((entry) => entry.id === column.id);
  if (index <= 0) return null;

  const leftColumn = columns[index - 1];
  return formatSummaryColumnHeaderParts(leftColumn, columns, rows).timeLine;
}

export function formatSummaryColumnHeaderParts(
  column: SummaryColumn,
  columns: SummaryColumn[],
  rows: SummaryRow[],
): SummaryColumnHeaderParts {
  if (column.kind === "slot") {
    return headerPartsFromDateAndTime(column.date, column.timeLocal);
  }

  if (column.kind === "previous_day_same_slot") {
    for (const row of rows) {
      const measurement = resolveSummaryColumnMeasurement(row, column);
      if (measurement) {
        return {
          dateLine: formatDateLine(new Date(measurement.scheduledDepartureAt)),
          timeLine: getLeftColumnTimeLine(column, columns, rows),
        };
      }
    }

    return {
      dateLine: "—",
      timeLine: getLeftColumnTimeLine(column, columns, rows),
    };
  }

  for (const row of rows) {
    const measurement = resolveSummaryColumnMeasurement(row, column);
    if (measurement) {
      return headerPartsFromMeasurement(measurement);
    }
  }

  return {
    dateLine: column.direction === "morning" ? "Morning" : "Evening",
    timeLine: null,
  };
}

export function formatSummaryColumnHeader(
  column: SummaryColumn,
  columns: SummaryColumn[],
  rows: SummaryRow[],
): string {
  const { dateLine, timeLine } = formatSummaryColumnHeaderParts(column, columns, rows);
  return timeLine ? `${dateLine} · ${timeLine}` : dateLine;
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

export function collectAvailableSlotOptions(rows: SummaryRow[]): SummarySlotOption[] {
  const seen = new Set<string>();
  const options: SummarySlotOption[] = [];

  for (const row of rows) {
    for (const measurement of row.measurements) {
      const date = getLocalDateKey(new Date(measurement.scheduledDepartureAt), DEFAULT_TIMEZONE);
      const timeLocal = getMeasurementBinnedTime(measurement);
      const key = `${measurement.direction}:${date}:${timeLocal}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const dateLine = formatDateLine(new Date(measurement.scheduledDepartureAt));
      const directionLabel = measurement.direction === "morning" ? "AM" : "PM";
      options.push({
        key,
        direction: measurement.direction,
        date,
        timeLocal,
        scheduledDepartureAt: measurement.scheduledDepartureAt,
        label: `${dateLine} ${timeLocal} (${directionLabel})`,
      });
    }
  }

  return options.sort(
    (a, b) =>
      new Date(b.scheduledDepartureAt).getTime() - new Date(a.scheduledDepartureAt).getTime(),
  );
}

export function parseStoredSummaryColumns(value: unknown): SummaryColumn[] {
  if (!Array.isArray(value)) return DEFAULT_SUMMARY_COLUMNS;

  const parsed = value
    .map((entry) => parseSummaryColumn(entry))
    .filter((entry): entry is SummaryColumn => entry != null);

  return parsed.length > 0 ? parsed : DEFAULT_SUMMARY_COLUMNS;
}

function parseSummaryColumn(value: unknown): SummaryColumn | null {
  if (!value || typeof value !== "object") return null;
  const column = value as Partial<SummaryColumn> & { kind?: string; direction?: string };
  if (typeof column.id !== "string" || !column.id) return null;
  if (column.direction !== "morning" && column.direction !== "evening") return null;

  if (column.kind === "latest" || column.kind === "previous_day_same_slot") {
    return { id: column.id, kind: column.kind, direction: column.direction };
  }

  if (column.kind === "slot") {
    const slotColumn = column as Partial<Extract<SummaryColumn, { kind: "slot" }>>;
    if (typeof slotColumn.date !== "string" || typeof slotColumn.timeLocal !== "string") {
      return null;
    }
    return {
      id: column.id,
      kind: "slot",
      direction: column.direction,
      date: slotColumn.date,
      timeLocal: slotColumn.timeLocal,
    };
  }

  return null;
}

export function createSlotSummaryColumn(
  direction: CommuteDirectionFilter,
  date: string,
  timeLocal: string,
): SummaryColumn {
  const binnedTime = binTimeLocalToTenMinutes(timeLocal);
  return {
    id: `slot-${direction}-${date}-${binnedTime}-${crypto.randomUUID()}`,
    kind: "slot",
    direction,
    date,
    timeLocal: binnedTime,
  };
}

export const PENDING_SUMMARY_COLUMN_KEY = "drive-time-tracker-pending-summary-column";

export type PendingSummaryColumn = {
  direction: CommuteDirectionFilter;
  date: string;
  timeLocal: string;
};

export function getBinnedTimeFromDate(date: Date): string {
  const parts = getZonedParts(date, DEFAULT_TIMEZONE);
  return `${String(parts.hour).padStart(2, "0")}:${String(binMinutesToTen(parts.minute)).padStart(2, "0")}`;
}

export function queuePendingSummaryColumn(
  direction: CommuteDirectionFilter,
  date = getLocalDateKey(new Date(), DEFAULT_TIMEZONE),
  timeLocal = getBinnedTimeFromDate(new Date()),
): void {
  if (typeof window === "undefined") return;
  const payload: PendingSummaryColumn = { direction, date, timeLocal };
  window.sessionStorage.setItem(PENDING_SUMMARY_COLUMN_KEY, JSON.stringify(payload));
}

export function takePendingSummaryColumn(): PendingSummaryColumn | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PENDING_SUMMARY_COLUMN_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(PENDING_SUMMARY_COLUMN_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingSummaryColumn;
    if (
      (parsed.direction === "morning" || parsed.direction === "evening") &&
      typeof parsed.date === "string" &&
      typeof parsed.timeLocal === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function columnAlreadyExists(columns: SummaryColumn[], candidate: SummaryColumn): boolean {
  return columns.some((column) => {
    if (column.kind !== candidate.kind || column.direction !== candidate.direction) {
      return false;
    }
    if (column.kind === "slot" && candidate.kind === "slot") {
      return column.date === candidate.date && column.timeLocal === candidate.timeLocal;
    }
    return true;
  });
}
