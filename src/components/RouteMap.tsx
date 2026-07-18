"use client";

import { useEffect } from "react";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import { decodePolyline, type LatLng } from "@/lib/polyline";
import {
  parseTrafficIntervals,
  trafficColor,
  trafficLabel,
  type RouteTrafficInterval,
  type RouteTrafficSpeed,
} from "@/lib/route-traffic";
import "leaflet/dist/leaflet.css";

type RouteSegment = {
  positions: LatLngExpression[];
  color: string;
  speed: RouteTrafficSpeed;
};

function buildTrafficSegments(
  points: LatLng[],
  intervals: RouteTrafficInterval[],
): RouteSegment[] {
  if (points.length < 2) return [];

  if (intervals.length === 0) {
    return [
      {
        positions: points.map((point) => [point.lat, point.lng]),
        color: trafficColor("UNKNOWN"),
        speed: "UNKNOWN",
      },
    ];
  }

  return intervals
    .map((interval) => ({
      positions: points
        .slice(interval.startIndex, interval.endIndex + 1)
        .map((point) => [point.lat, point.lng] as LatLngExpression),
      color: trafficColor(interval.speed),
      speed: interval.speed,
    }))
    .filter((segment) => segment.positions.length >= 2);
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(
      points.map((point) => [point.lat, point.lng] as LatLngTuple),
      { padding: [24, 24] },
    );
  }, [map, points]);

  return null;
}

export function RouteMap({
  routePolyline,
  routeTrafficJson,
}: {
  routePolyline: string;
  routeTrafficJson: string | null;
}) {
  const points = decodePolyline(routePolyline);
  const intervals = parseTrafficIntervals(routeTrafficJson);
  const segments = buildTrafficSegments(points, intervals);

  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Route data could not be decoded.
      </div>
    );
  }

  const center = points[Math.floor(points.length / 2)];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={11}
          scrollWheelZoom
          className="h-[420px] w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {segments.map((segment, index) => (
            <Polyline
              key={`${segment.speed}-${index}`}
              positions={segment.positions}
              pathOptions={{ color: segment.color, weight: 6, opacity: 0.9 }}
            />
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        {(["NORMAL", "SLOW", "TRAFFIC_JAM", "UNKNOWN"] as RouteTrafficSpeed[]).map(
          (speed) => (
            <span key={speed} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3 w-8 rounded-full"
                style={{ backgroundColor: trafficColor(speed) }}
              />
              {trafficLabel(speed)}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
