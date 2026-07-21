export type RouteWaypoint = {
  latitude: number;
  longitude: number;
};

export type RouteWaypointDraft = {
  latitude: string;
  longitude: string;
};

export function parseRouteWaypoints(json: string | null | undefined): RouteWaypoint[] {
  if (!json) return [];

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => normalizeWaypoint(entry))
      .filter((entry): entry is RouteWaypoint => entry != null);
  } catch {
    return [];
  }
}

function normalizeWaypoint(value: unknown): RouteWaypoint | null {
  if (!value || typeof value !== "object") return null;

  const latitude = Number((value as RouteWaypoint).latitude);
  const longitude = Number((value as RouteWaypoint).longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

export function serializeRouteWaypoints(waypoints: RouteWaypoint[]): string | null {
  if (waypoints.length === 0) return null;
  return JSON.stringify(waypoints);
}

export function waypointsToDrafts(waypoints: RouteWaypoint[]): RouteWaypointDraft[] {
  return waypoints.map((waypoint) => ({
    latitude: String(waypoint.latitude),
    longitude: String(waypoint.longitude),
  }));
}

export function draftsToWaypoints(drafts: RouteWaypointDraft[]): RouteWaypoint[] | string {
  if (drafts.length === 0) return [];

  const waypoints: RouteWaypoint[] = [];
  for (const [index, draft] of drafts.entries()) {
    const latitude = Number(draft.latitude.trim());
    const longitude = Number(draft.longitude.trim());

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return `Waypoint ${index + 1}: enter valid latitude and longitude`;
    }
    if (latitude < -90 || latitude > 90) {
      return `Waypoint ${index + 1}: latitude must be between -90 and 90`;
    }
    if (longitude < -180 || longitude > 180) {
      return `Waypoint ${index + 1}: longitude must be between -180 and 180`;
    }

    waypoints.push({ latitude, longitude });
  }

  if (waypoints.length > 25) {
    return "At most 25 waypoints are allowed";
  }

  return waypoints;
}

export function formatWaypointSummary(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 route waypoint" : `${count} route waypoints`;
}
