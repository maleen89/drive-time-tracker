"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collectAvailableSlotOptions,
  columnAlreadyExists,
  createSlotSummaryColumn,
  DEFAULT_SUMMARY_COLUMNS,
  formatMeasurementDuration,
  formatMeasurementTooltip,
  formatRowDistance,
  formatSummaryColumnHeaderParts,
  parseStoredSummaryColumns,
  resolveSummaryColumnMeasurement,
  takePendingSummaryColumn,
  type SummaryColumn,
  type SummaryRow,
} from "@/lib/home-commute-summary";
import { measurementDetailHref } from "@/lib/measurement-navigation";

const STORAGE_KEY = "drive-time-tracker-summary-columns";

function loadStoredColumns(): SummaryColumn[] {
  if (typeof window === "undefined") return DEFAULT_SUMMARY_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SUMMARY_COLUMNS;
    return parseStoredSummaryColumns(JSON.parse(raw));
  } catch {
    return DEFAULT_SUMMARY_COLUMNS;
  }
}

function SummaryColumnHeader({
  column,
  columns,
  rows,
  onRemove,
}: {
  column: SummaryColumn;
  columns: SummaryColumn[];
  rows: SummaryRow[];
  onRemove: () => void;
}) {
  const { dateLine, timeLine } = formatSummaryColumnHeaderParts(column, columns, rows);

  return (
    <div className="flex items-start gap-1">
      <span className="min-w-0 leading-tight">
        <span className="block whitespace-nowrap">{dateLine}</span>
        {timeLine && <span className="block font-mono text-xs whitespace-nowrap">{timeLine}</span>}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-slate-400 hover:text-red-600"
        aria-label="Remove column"
        title="Remove column"
      >
        ×
      </button>
    </div>
  );
}

export function CommuteSummaryTable({ rows }: { rows: SummaryRow[] }) {
  const [columns, setColumns] = useState<SummaryColumn[]>(DEFAULT_SUMMARY_COLUMNS);
  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  useEffect(() => {
    setColumns(loadStoredColumns());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
    const pending = takePendingSummaryColumn();
    if (!pending) return;

    setColumns((current) => {
      const next = createSlotSummaryColumn(
        pending.direction,
        pending.date,
        pending.timeLocal,
      );
      if (columnAlreadyExists(current, next)) {
        return current;
      }
      return [...current, next];
    });
  }, [rows]);

  const slotOptions = useMemo(() => collectAvailableSlotOptions(rows), [rows]);

  useEffect(() => {
    if (slotOptions.length === 0) {
      setSelectedSlotKey("");
      return;
    }
    if (!slotOptions.some((option) => option.key === selectedSlotKey)) {
      setSelectedSlotKey(slotOptions[0]!.key);
    }
  }, [slotOptions, selectedSlotKey]);

  function removeColumn(columnId: string) {
    setColumns((current) => current.filter((column) => column.id !== columnId));
  }

  function addSelectedColumn() {
    const option = slotOptions.find((entry) => entry.key === selectedSlotKey);
    if (!option) return;

    setColumns((current) => {
      const next = createSlotSummaryColumn(option.direction, option.date, option.timeLocal);
      if (columnAlreadyExists(current, next)) {
        return current;
      }
      return [...current, next];
    });
  }

  function resetColumns() {
    setColumns(DEFAULT_SUMMARY_COLUMNS);
  }

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
      <div className="space-y-2 px-4 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addSelectedColumn}
            disabled={!selectedSlotKey}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Add column
          </button>
          <button
            type="button"
            onClick={resetColumns}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Reset columns
          </button>
        </div>
        {slotOptions.length > 0 ? (
          <label className="block max-w-md text-sm">
            <span className="sr-only">Choose a timeslot</span>
            <select
              value={selectedSlotKey}
              onChange={(event) => setSelectedSlotKey(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {slotOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm text-slate-500">No measurements yet to add as columns.</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">Distance</th>
              {columns.map((column) => (
                <th key={column.id} className="px-2 py-2 font-medium align-top">
                  <SummaryColumnHeader
                    column={column}
                    columns={columns}
                    rows={rows}
                    onRemove={() => removeColumn(column.id)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.homeId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.homeLabel}</div>
                  <div className="text-slate-600">{row.homeAddress}</div>
                </td>
                <td className="px-3 py-2">{formatRowDistance(row.distanceMeters)}</td>
                {columns.map((column) => {
                  const measurement = resolveSummaryColumnMeasurement(row, column);
                  return (
                    <td key={column.id} className="px-2 py-2">
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
    </div>
  );
}
