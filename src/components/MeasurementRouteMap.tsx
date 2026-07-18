"use client";

import nextDynamic from "next/dynamic";

const RouteMap = nextDynamic(
  () => import("@/components/RouteMap").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600">
        Loading map…
      </div>
    ),
  },
);

export function MeasurementRouteMap({
  routePolyline,
  routeTrafficJson,
}: {
  routePolyline: string;
  routeTrafficJson: string | null;
}) {
  return (
    <RouteMap routePolyline={routePolyline} routeTrafficJson={routeTrafficJson} />
  );
}
