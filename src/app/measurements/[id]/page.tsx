import { MeasurementBackLink } from "@/components/MeasurementBackLink";
import { MeasurementRouteMap } from "@/components/MeasurementRouteMap";
import { RouteRecentHistory } from "@/components/RouteRecentHistory";
import { prisma } from "@/lib/db";
import { resolveMeasurementReturnTo } from "@/lib/measurement-navigation";
import { pairLabel } from "@/lib/tracked-pairs";
import {
  DEFAULT_TIMEZONE,
  formatDateTime,
  formatDistance,
  formatDuration,
} from "@/lib/time";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MeasurementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: returnToParam } = await searchParams;
  const returnTo = resolveMeasurementReturnTo(returnToParam);

  const measurement = await prisma.measurement.findUnique({
    where: { id },
    include: {
      trackedPair: { include: { originLocation: true, destinationLocation: true } },
      pairScheduleSlot: true,
    },
  });

  if (!measurement) {
    notFound();
  }

  const recentOnRoute = await prisma.measurement.findMany({
    where: {
      trackedPairId: measurement.trackedPairId,
      status: "OK",
    },
    orderBy: { scheduledDepartureAt: "desc" },
    take: 50,
    include: { pairScheduleSlot: true },
  });

  const recentMeasurements = recentOnRoute.map((entry) => ({
    id: entry.id,
    scheduledDepartureAt: entry.scheduledDepartureAt.toISOString(),
    durationInTrafficSeconds: entry.durationInTrafficSeconds,
    durationSeconds: entry.durationSeconds,
    slotTimeLocal: entry.pairScheduleSlot?.timeLocal ?? null,
    status: entry.status,
  }));

  const hasRoute = Boolean(measurement.routePolyline);
  const currentSlotTimeLocal = measurement.pairScheduleSlot?.timeLocal ?? null;

  return (
    <div className="space-y-6">
      <div>
        <MeasurementBackLink returnTo={returnTo} />
        <h1 className="mt-2 text-2xl font-semibold">Route snapshot</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pairLabel(measurement.trackedPair)} ·{" "}
          {formatDateTime(measurement.scheduledDepartureAt, DEFAULT_TIMEZONE)}
        </p>
      </div>

      <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Drive time</p>
          <p className="mt-1 font-medium">
            {formatDuration(
              measurement.durationInTrafficSeconds ?? measurement.durationSeconds,
            )}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Distance</p>
          <p className="mt-1 font-medium">{formatDistance(measurement.distanceMeters)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Slot</p>
          <p className="mt-1 font-medium font-mono">
            {measurement.pairScheduleSlot?.timeLocal ?? "manual"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 font-medium">{measurement.status}</p>
        </div>
      </section>

      {hasRoute ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-medium">Route at measurement time</h2>
          <p className="mb-4 text-sm text-slate-600">
            Traffic colors were captured when this measurement ran. No routing API is called
            when you view this page.
          </p>
          <MeasurementRouteMap
            routePolyline={measurement.routePolyline!}
            routeTrafficJson={measurement.routeTrafficJson}
          />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <h2 className="font-medium text-slate-800">No route stored</h2>
          <p className="mt-2 text-sm text-slate-600">
            This measurement was recorded before route snapshots were enabled, or the Routes
            API did not return a polyline.
          </p>
        </section>
      )}

      {measurement.errorMessage ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {measurement.errorMessage}
        </section>
      ) : null}

      <RouteRecentHistory
        currentMeasurementId={measurement.id}
        currentSlotTimeLocal={currentSlotTimeLocal}
        measurements={recentMeasurements}
        timeZone={DEFAULT_TIMEZONE}
        returnTo={returnTo}
      />
    </div>
  );
}
