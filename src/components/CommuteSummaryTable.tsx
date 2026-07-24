"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMeasurementLookup,
  collectAvailableTimeOptions,
  collectAvailableWeekOptions,
  findMeasurementInLookup,
  formatMeasurementDuration,
  formatMeasurementTooltip,
  formatRowDistance,
  formatWeekDayColumnHeader,
  getWeekDayDateKeys,
  parseTimeOptionKey,
  pickDefaultTimeKey,
  pickDefaultWeekKey,
  type SummaryRow,
} from "@/lib/home-commute-summary";
import { measurementDetailHref } from "@/lib/measurement-navigation";

const WEEK_STORAGE_KEY = "drive-time-tracker-summary-week";
const TIME_STORAGE_KEY = "drive-time-tracker-summary-time";
const ROUTES_STORAGE_KEY = "drive-time-tracker-summary-routes";

function loadStoredSelection(
  key: string,
  fallback: string,
  validKeys: Set<string>,
): string {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && validKeys.has(stored)) return stored;
  } catch {
    // Ignore storage errors.
  }
  return fallback;
}

function loadStoredRouteIds(allIds: string[]): Set<string> {
  if (typeof window === "undefined") return new Set(allIds);
  try {
    const raw = window.localStorage.getItem(ROUTES_STORAGE_KEY);
    if (!raw) return new Set(allIds);

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(allIds);

    const valid = parsed.filter(
      (id): id is string => typeof id === "string" && allIds.includes(id),
    );
    return valid.length > 0 ? new Set(valid) : new Set(allIds);
  } catch {
    return new Set(allIds);
  }
}

function RouteFilterMenu({
  rows,
  selectedRouteIds,
  onChange,
}: {
  rows: SummaryRow[];
  selectedRouteIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectedCount = rows.filter((row) => selectedRouteIds.has(row.homeId)).length;
  const summaryLabel =
    selectedCount === rows.length
      ? `All routes (${rows.length})`
      : `${selectedCount} of ${rows.length} routes`;

  function toggleRoute(homeId: string, checked: boolean) {
    const next = new Set(selectedRouteIds);
    if (checked) {
      next.add(homeId);
    } else {
      next.delete(homeId);
    }
    onChange(next);
  }

  return (
    <div ref={containerRef} className="relative block text-sm">
      <span className="mb-1 block font-medium text-slate-700">Routes</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{summaryLabel}</span>
        <span className="ml-2 text-slate-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[16rem] rounded border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(new Set(rows.map((row) => row.homeId)))}
              className="text-blue-600 hover:text-blue-700"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-slate-600 hover:text-slate-900"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {rows.map((row) => (
              <label
                key={row.homeId}
                className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedRouteIds.has(row.homeId)}
                  onChange={(event) => toggleRoute(row.homeId, event.target.checked)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-900">{row.homeLabel}</span>
                  <span className="block truncate text-xs text-slate-600">{row.homeAddress}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CommuteSummaryTable({ rows }: { rows: SummaryRow[] }) {
  const timeOptions = useMemo(() => collectAvailableTimeOptions(rows), [rows]);
  const weekOptions = useMemo(() => collectAvailableWeekOptions(rows), [rows]);
  const measurementLookup = useMemo(() => buildMeasurementLookup(rows), [rows]);

  const defaultWeekKey = useMemo(() => pickDefaultWeekKey(rows), [rows]);
  const defaultTimeKey = useMemo(() => pickDefaultTimeKey(rows), [rows]);

  const [selectedWeekKey, setSelectedWeekKey] = useState(defaultWeekKey);
  const [selectedTimeKey, setSelectedTimeKey] = useState(defaultTimeKey);
  const allRouteIds = useMemo(() => rows.map((row) => row.homeId), [rows]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(
    () => new Set(allRouteIds),
  );
  const routesHydratedRef = useRef(false);

  useEffect(() => {
    const weekKeys = new Set(weekOptions.map((option) => option.key));
    const timeKeys = new Set(timeOptions.map((option) => option.key));
    const nextWeek = loadStoredSelection(WEEK_STORAGE_KEY, defaultWeekKey, weekKeys);
    const nextTime = loadStoredSelection(TIME_STORAGE_KEY, defaultTimeKey, timeKeys);

    setSelectedWeekKey(weekKeys.has(nextWeek) ? nextWeek : defaultWeekKey);
    setSelectedTimeKey(timeKeys.has(nextTime) ? nextTime : defaultTimeKey);
  }, [defaultTimeKey, defaultWeekKey, timeOptions, weekOptions]);

  useEffect(() => {
    if (!routesHydratedRef.current) {
      setSelectedRouteIds(loadStoredRouteIds(allRouteIds));
      routesHydratedRef.current = true;
      return;
    }

    setSelectedRouteIds((current) => {
      const next = new Set(allRouteIds.filter((id) => current.has(id)));
      for (const id of allRouteIds) {
        if (!current.has(id)) {
          next.add(id);
        }
      }
      return next.size > 0 ? next : new Set(allRouteIds);
    });
  }, [allRouteIds]);

  useEffect(() => {
    if (selectedWeekKey) {
      window.localStorage.setItem(WEEK_STORAGE_KEY, selectedWeekKey);
    }
  }, [selectedWeekKey]);

  useEffect(() => {
    if (selectedTimeKey) {
      window.localStorage.setItem(TIME_STORAGE_KEY, selectedTimeKey);
    }
  }, [selectedTimeKey]);

  useEffect(() => {
    window.localStorage.setItem(
      ROUTES_STORAGE_KEY,
      JSON.stringify(allRouteIds.filter((id) => selectedRouteIds.has(id))),
    );
  }, [allRouteIds, selectedRouteIds]);

  const weekDayDates = useMemo(
    () => getWeekDayDateKeys(selectedWeekKey),
    [selectedWeekKey],
  );

  const selectedTime = useMemo(
    () => parseTimeOptionKey(selectedTimeKey),
    [selectedTimeKey],
  );

  const visibleRows = useMemo(
    () => rows.filter((row) => selectedRouteIds.has(row.homeId)),
    [rows, selectedRouteIds],
  );

  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-slate-500">
        No home → work pairs yet.{" "}
        <Link href="/setup" className="underline">
          Configure setup
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 px-4 pt-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Week</span>
          <select
            value={selectedWeekKey}
            onChange={(event) => setSelectedWeekKey(event.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {weekOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Time</span>
          <select
            value={selectedTimeKey}
            onChange={(event) => setSelectedTimeKey(event.target.value)}
            disabled={timeOptions.length === 0}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {timeOptions.length === 0 ? (
              <option value="">No measurements yet</option>
            ) : (
              timeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </label>

        <RouteFilterMenu
          rows={rows}
          selectedRouteIds={selectedRouteIds}
          onChange={setSelectedRouteIds}
        />
      </div>

      {visibleRows.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-slate-500">
          No routes selected. Choose at least one route from the Routes menu.
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">Distance</th>
              {weekDayDates.map((dateKey) => {
                const { weekday, dateLine } = formatWeekDayColumnHeader(dateKey);
                return (
                  <th key={dateKey} className="px-2 py-2 font-medium align-top">
                    <span className="block whitespace-nowrap">{weekday}</span>
                    <span className="block font-mono text-xs whitespace-nowrap">{dateLine}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.homeId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.homeLabel}</div>
                  <div className="text-slate-600">{row.homeAddress}</div>
                </td>
                <td className="px-3 py-2">{formatRowDistance(row.distanceMeters)}</td>
                {weekDayDates.map((dateKey) => {
                  const measurement =
                    selectedTime &&
                    findMeasurementInLookup(
                      measurementLookup,
                      row,
                      dateKey,
                      selectedTime.direction,
                      selectedTime.timeLocal,
                    );

                  return (
                    <td key={dateKey} className="px-2 py-2">
                      {measurement ? (
                        <Link
                          href={measurementDetailHref(measurement.id, "/")}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                          title={formatMeasurementTooltip(measurement)}
                        >
                          {formatMeasurementDuration(measurement)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
