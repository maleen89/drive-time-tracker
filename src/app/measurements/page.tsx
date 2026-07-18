import Link from "next/link";
import { MeasurementsChart } from "@/components/MeasurementsChart";
import { prisma } from "@/lib/db";
import { measurementDetailHref } from "@/lib/measurement-navigation";
import { pairLabel } from "@/lib/tracked-pairs";
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatDistance,
  formatDuration,
} from "@/lib/time";

export const dynamic = "force-dynamic";

const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

export default async function MeasurementsPage() {
  const pairs = await prisma.trackedPair.findMany({
    orderBy: { createdAt: "asc" },
    include: { originLocation: true, destinationLocation: true },
  });

  const measurementsByPair = await Promise.all(
    pairs.map(async (pair) => {
      const measurements = await prisma.measurement.findMany({
        where: { trackedPairId: pair.id, status: "OK" },
        orderBy: { scheduledDepartureAt: "asc" },
        take: 200,
        include: { pairScheduleSlot: true },
      });

      const chartData = measurements.map((m) => ({
        label: formatDateTime(m.scheduledDepartureAt, DEFAULT_TIMEZONE),
        minutes: Math.round((m.durationInTrafficSeconds ?? m.durationSeconds ?? 0) / 60),
      }));

      return { pair, chartData };
    }),
  );

  const recent = await prisma.measurement.findMany({
    orderBy: { scheduledDepartureAt: "desc" },
    take: 50,
    include: {
      trackedPair: { include: { originLocation: true, destinationLocation: true } },
      pairScheduleSlot: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Drive time trends and raw measurement log.
          </p>
        </div>
        <Link
          href="/api/measurements/export"
          className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Export CSV
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {measurementsByPair.map(({ pair, chartData }, index) => (
          <section key={pair.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-medium">{pairLabel(pair)}</h2>
            <MeasurementsChart
              data={chartData}
              seriesKey={pairLabel(pair)}
              color={COLORS[index % COLORS.length]}
            />
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-medium">All measurements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Scheduled</th>
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Drive time</th>
                <th className="px-3 py-2 font-medium">Distance</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link
                      href={measurementDetailHref(m.id, "/measurements")}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {formatDateTime(m.scheduledDepartureAt, DEFAULT_TIMEZONE)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{pairLabel(m.trackedPair)}</td>
                  <td className="px-3 py-2 font-mono">
                    {m.pairScheduleSlot?.timeLocal ?? "manual"}
                  </td>
                  <td className="px-3 py-2">
                    {formatDuration(m.durationInTrafficSeconds ?? m.durationSeconds)}
                  </td>
                  <td className="px-3 py-2">{formatDistance(m.distanceMeters)}</td>
                  <td className="px-3 py-2">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
