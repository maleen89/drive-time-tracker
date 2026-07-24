import Link from "next/link";
import { CommuteSummaryTable } from "@/components/CommuteSummaryTable";
import { NextRunCountdown } from "@/components/NextRunCountdown";
import { RunNowButton } from "@/components/RunNowButton";
import { prisma } from "@/lib/db";
import { isBuiltinSchedulerEnabled } from "@/lib/builtin-scheduler";
import { buildSummaryRows } from "@/lib/home-commute-summary";
import { measurementDetailHref } from "@/lib/measurement-navigation";
import { buildScheduleInputs, getNextScheduleRun } from "@/lib/schedule-utils";
import { pairLabel } from "@/lib/tracked-pairs";
import { DEFAULT_TIMEZONE, formatDateTime, formatDuration } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [pairs, recentMeasurements, measurementCount] = await Promise.all([
    prisma.trackedPair.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        originLocation: true,
        destinationLocation: true,
        scheduleSlots: { where: { active: true } },
        measurements: {
          where: { status: "OK" },
          orderBy: { scheduledDepartureAt: "desc" },
          take: 120,
          include: { pairScheduleSlot: true },
        },
      },
    }),
    prisma.measurement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        trackedPair: {
          include: { originLocation: true, destinationLocation: true },
        },
        pairScheduleSlot: true,
      },
    }),
    prisma.measurement.count(),
  ]);

  const scheduleInputs = buildScheduleInputs(pairs);
  const nextRun = getNextScheduleRun(scheduleInputs);
  const schedulerEnabled = isBuiltinSchedulerEnabled();
  const summaryRows = buildSummaryRows(pairs);
  const activeSlotCount = pairs.reduce((sum, pair) => sum + pair.scheduleSlots.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            {pairs.filter((p) => p.active).length} active pairs · {activeSlotCount} scheduled
            times · {measurementCount} measurements stored
          </p>
          {schedulerEnabled ? (
            <p className="mt-1 text-sm text-emerald-700">
              Built-in scheduler on — checks every{" "}
              {process.env.SCHEDULER_INTERVAL_MINUTES ?? 5} minutes while the server is running.
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">
              Built-in scheduler off — set ENABLE_BUILTIN_SCHEDULER=true in .env for automatic
              runs on this PC.
            </p>
          )}
        </div>
        <RunNowButton />
      </div>

      <NextRunCountdown nextRun={nextRun} />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="font-medium">Commute summary</h2>
        </div>
        <CommuteSummaryTable rows={summaryRows} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-medium">Recent measurements</h2>
          <Link href="/measurements" className="text-sm text-slate-600 hover:text-slate-900">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Recorded</th>
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">Slot</th>
                <th className="px-3 py-2 font-medium">Drive time</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentMeasurements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No measurements yet. Use Run morning/evening or wait for scheduled runs.
                  </td>
                </tr>
              ) : (
                recentMeasurements.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {formatDateTime(m.createdAt, DEFAULT_TIMEZONE)}
                    </td>
                    <td className="px-3 py-2">{pairLabel(m.trackedPair)}</td>
                    <td className="px-3 py-2 font-mono">
                      {m.pairScheduleSlot?.timeLocal ?? "manual"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={measurementDetailHref(m.id, "/")}
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {formatDuration(m.durationInTrafficSeconds ?? m.durationSeconds)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{m.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
