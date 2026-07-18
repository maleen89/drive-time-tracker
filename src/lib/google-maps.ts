import type { RouteTrafficInterval, RouteTrafficSpeed } from "@/lib/route-traffic";

export interface DrivingRouteResult {
  durationSeconds: number | null;
  durationInTrafficSeconds: number | null;
  distanceMeters: number | null;
  routePolyline: string | null;
  routeTrafficJson: string | null;
  status: string;
  errorMessage: string | null;
}

interface RoutesResponse {
  routes?: Array<{
    duration?: string;
    staticDuration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    travelAdvisory?: {
      speedReadingIntervals?: Array<{
        startPolylinePointIndex?: number;
        endPolylinePointIndex?: number;
        speed?: string;
      }>;
    };
  }>;
  error?: { message?: string; status?: string };
}

function parseDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d+)s$/.exec(value);
  return match ? Number(match[1]) : null;
}

function normalizeSpeed(value: string | undefined): RouteTrafficSpeed {
  if (value === "NORMAL" || value === "SLOW" || value === "TRAFFIC_JAM") {
    return value;
  }
  return "UNKNOWN";
}

function serializeTrafficIntervals(
  intervals:
    | Array<{
        startPolylinePointIndex?: number;
        endPolylinePointIndex?: number;
        speed?: string;
      }>
    | undefined,
): string | null {
  if (!intervals?.length) return null;

  const normalized: RouteTrafficInterval[] = intervals
    .filter(
      (interval) =>
        interval.startPolylinePointIndex != null &&
        interval.endPolylinePointIndex != null,
    )
    .map((interval) => ({
      startIndex: interval.startPolylinePointIndex!,
      endIndex: interval.endPolylinePointIndex!,
      speed: normalizeSpeed(interval.speed),
    }));

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

const ROUTES_DEPARTURE_BUFFER_MS = 60_000;

/** Routes API requires departure time strictly in the future. */
function resolveRoutesDepartureTime(departureTime: Date): Date {
  const minimumFuture = Date.now() + ROUTES_DEPARTURE_BUFFER_MS;
  return new Date(Math.max(departureTime.getTime(), minimumFuture));
}

export async function fetchDrivingRoute(
  origin: string,
  destination: string,
  departureTime: Date,
): Promise<DrivingRouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      durationSeconds: null,
      durationInTrafficSeconds: null,
      distanceMeters: null,
      routePolyline: null,
      routeTrafficJson: null,
      status: "ERROR",
      errorMessage: "GOOGLE_MAPS_API_KEY is not configured",
    };
  }

  const routesDepartureAt = resolveRoutesDepartureTime(departureTime);

  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: routesDepartureAt.toISOString(),
    extraComputations: ["TRAFFIC_ON_POLYLINE"],
  };

  const fieldMask = [
    "routes.duration",
    "routes.staticDuration",
    "routes.distanceMeters",
    "routes.polyline.encodedPolyline",
    "routes.travelAdvisory.speedReadingIntervals",
  ].join(",");

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    });

    const data = (await response.json()) as RoutesResponse;

    if (!response.ok) {
      return {
        durationSeconds: null,
        durationInTrafficSeconds: null,
        distanceMeters: null,
        routePolyline: null,
        routeTrafficJson: null,
        status: "ERROR",
        errorMessage: data.error?.message ?? `Routes API HTTP ${response.status}`,
      };
    }

    const route = data.routes?.[0];
    if (!route) {
      return {
        durationSeconds: null,
        durationInTrafficSeconds: null,
        distanceMeters: null,
        routePolyline: null,
        routeTrafficJson: null,
        status: "ERROR",
        errorMessage: "No route returned",
      };
    }

    const durationSeconds = parseDurationSeconds(route.staticDuration ?? route.duration);
    const durationInTrafficSeconds = parseDurationSeconds(route.duration);

    return {
      durationSeconds,
      durationInTrafficSeconds,
      distanceMeters: route.distanceMeters ?? null,
      routePolyline: route.polyline?.encodedPolyline ?? null,
      routeTrafficJson: serializeTrafficIntervals(route.travelAdvisory?.speedReadingIntervals),
      status: "OK",
      errorMessage: null,
    };
  } catch (error) {
    return {
      durationSeconds: null,
      durationInTrafficSeconds: null,
      distanceMeters: null,
      routePolyline: null,
      routeTrafficJson: null,
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

/** @deprecated Use fetchDrivingRoute */
export type DistanceMatrixResult = Omit<DrivingRouteResult, "routePolyline" | "routeTrafficJson">;

/** @deprecated Use fetchDrivingRoute */
export async function fetchDrivingDistance(
  origin: string,
  destination: string,
  departureTime: Date,
): Promise<DistanceMatrixResult> {
  const route = await fetchDrivingRoute(origin, destination, departureTime);
  return {
    durationSeconds: route.durationSeconds,
    durationInTrafficSeconds: route.durationInTrafficSeconds,
    distanceMeters: route.distanceMeters,
    status: route.status,
    errorMessage: route.errorMessage,
  };
}
