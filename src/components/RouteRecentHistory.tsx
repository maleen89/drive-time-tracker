"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  measurementDetailHref,
  type MeasurementReturnPath,
} from "@/lib/measurement-navigation";

export type RouteRecentMeasurement = {
  id: string;
  scheduledDepartureAt: string;
  durationInTrafficSeconds: number | null;
  durationSeconds: number | null;
  slotTimeLocal: string | null;
  status: string;
};

type FilterMode = "all" | "same-slot";

function measurementMinutes(measurement: RouteRecentMeasurement): number | null {
  const seconds = measurement.durationInTrafficSeconds ?? measurement.durationSeconds;
  return seconds == null ? null : Math.round(seconds / 60);
}

function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  return `${minutes} min`;
}

function formatScheduledLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatChartLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function matchesSlot(
  measurement: RouteRecentMeasurement,
  slotTimeLocal: string | null,
): boolean {
  return measurement.slotTimeLocal === slotTimeLocal;
}

export function RouteRecentHistory({
  currentMeasurementId,
  currentSlotTimeLocal,
  measurements,
  timeZone,
  returnTo,
}: {
  currentMeasurementId: string;
  currentSlotTimeLocal: string | null;
  measurements: RouteRecentMeasurement[];
  timeZone: string;
  returnTo: MeasurementReturnPath;
}) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    if (filter === "same-slot") {
      return measurements.filter((measurement) =>
        matchesSlot(measurement, currentSlotTimeLocal),
      );
    }
    return measurements;
  }, [filter, measurements, currentSlotTimeLocal]);

  const chartData = useMemo(() => {
    return [...filtered]
      .sort(
        (a, b) =>
          new Date(a.scheduledDepartureAt).getTime() -
          new Date(b.scheduledDepartureAt).getTime(),
      )
      .map((measurement) => ({
        id: measurement.id,
        label: formatChartLabel(measurement.scheduledDepartureAt, timeZone),
        minutes: measurementMinutes(measurement) ?? 0,
        isCurrent: measurement.id === currentMeasurementId,
      }))
      .filter((point) => point.minutes > 0);
  }, [filtered, currentMeasurementId, timeZone]);

  const sameSlotLabel = currentSlotTimeLocal ?? "manual";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">Recent on this route</h2>
          <p className="mt-1 text-sm text-slate-600">
            Drive times for the same origin → destination pair.
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
          role="tablist"
          aria-label="Filter recent measurements"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setFilter("all")}
          >
            All recent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "same-slot"}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === "same-slot"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setFilter("same-slot")}
          >
            Same slot only
          </button>
        </div>
      </div>

      {filter === "same-slot" ? (
        <p className="mt-3 text-sm text-slate-500">
          Showing only <span className="font-mono">{sameSlotLabel}</span> departures.
        </p>
      ) : null}

      {chartData.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No other measurements match this filter yet.
        </p>
      ) : (
        <div className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis unit=" min" tick={{ fontSize: 11 }} width={40} />
              <Tooltip
                formatter={(value: number, _name, item) => {
                  const point = item.payload as { isCurrent?: boolean };
                  const suffix = point.isCurrent ? " (this snapshot)" : "";
                  return [`${value} min${suffix}`, "Drive time"];
                }}
              />
              <Line
                type="monotone"
                dataKey="minutes"
                name="Drive time"
                stroke="#2563eb"
                strokeWidth={2}
                dot={({ cx, cy, payload }) => {
                  if (cx == null || cy == null) {
                    return <g />;
                  }
                  const point = payload as { isCurrent?: boolean };
                  if (point.isCurrent) {
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill="#2563eb"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    );
                  }
                  return <circle cx={cx} cy={cy} r={3} fill="#2563eb" />;
                }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {filtered.length === 0 ? null : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Drive time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((measurement) => {
                const isCurrent = measurement.id === currentMeasurementId;
                const minutes = measurementMinutes(measurement);
                const durationLabel = formatDurationMinutes(minutes);

                return (
                  <tr
                    key={measurement.id}
                    className={`border-t border-slate-100 ${
                      isCurrent ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-3 py-2">
                      {formatScheduledLabel(measurement.scheduledDepartureAt, timeZone)}
                      {isCurrent ? (
                        <span className="ml-2 text-xs font-medium text-blue-700">
                          current
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {measurement.slotTimeLocal ?? "manual"}
                    </td>
                    <td className="px-3 py-2">
                      {isCurrent ? (
                        <span className="font-semibold text-slate-900">{durationLabel}</span>
                      ) : (
                        <Link
                          href={measurementDetailHref(measurement.id, returnTo)}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {durationLabel}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
