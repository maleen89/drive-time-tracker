export type RouteTrafficSpeed = "NORMAL" | "SLOW" | "TRAFFIC_JAM" | "UNKNOWN";

export type RouteTrafficInterval = {
  startIndex: number;
  endIndex: number;
  speed: RouteTrafficSpeed;
};

export function trafficColor(speed: RouteTrafficSpeed): string {
  switch (speed) {
    case "NORMAL":
      return "#4285F4";
    case "SLOW":
      return "#FBBC04";
    case "TRAFFIC_JAM":
      return "#EA4335";
    default:
      return "#9AA0A6";
  }
}

export function trafficLabel(speed: RouteTrafficSpeed): string {
  switch (speed) {
    case "NORMAL":
      return "Normal traffic";
    case "SLOW":
      return "Slow traffic";
    case "TRAFFIC_JAM":
      return "Heavy traffic";
    default:
      return "Unknown traffic";
  }
}

export function parseTrafficIntervals(json: string | null | undefined): RouteTrafficInterval[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as RouteTrafficInterval[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
