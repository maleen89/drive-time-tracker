import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pairLabel } from "@/lib/tracked-pairs";
import { DEFAULT_TIMEZONE, formatDateTime } from "@/lib/time";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const trackedPairId = request.nextUrl.searchParams.get("trackedPairId");

  const measurements = await prisma.measurement.findMany({
    where: trackedPairId ? { trackedPairId } : undefined,
    orderBy: { scheduledDepartureAt: "desc" },
    include: {
      trackedPair: { include: { originLocation: true, destinationLocation: true } },
      pairScheduleSlot: true,
    },
  });

  const header = [
    "recorded_at",
    "scheduled_departure",
    "pair_label",
    "origin",
    "destination",
    "slot_time",
    "duration_minutes",
    "duration_in_traffic_minutes",
    "distance_miles",
    "status",
    "error",
  ].join(",");

  const rows = measurements.map((m) => {
    const tz = m.pairScheduleSlot?.timezone ?? DEFAULT_TIMEZONE;
    const durationMin =
      m.durationSeconds != null ? (m.durationSeconds / 60).toFixed(1) : "";
    const trafficMin =
      m.durationInTrafficSeconds != null
        ? (m.durationInTrafficSeconds / 60).toFixed(1)
        : "";
    const miles =
      m.distanceMeters != null ? (m.distanceMeters / 1609.344).toFixed(2) : "";

    return [
      formatDateTime(m.createdAt, tz),
      formatDateTime(m.scheduledDepartureAt, tz),
      escapeCsv(pairLabel(m.trackedPair)),
      escapeCsv(m.trackedPair.originLocation.address),
      escapeCsv(m.trackedPair.destinationLocation.address),
      m.pairScheduleSlot?.timeLocal ?? "manual",
      durationMin,
      trafficMin,
      miles,
      m.status,
      escapeCsv(m.errorMessage ?? ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="drive-time-measurements.csv"',
    },
  });
}
