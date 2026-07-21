import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  draftsToWaypoints,
  serializeRouteWaypoints,
  type RouteWaypoint,
  type RouteWaypointDraft,
} from "@/lib/route-waypoints";
import { formatDaysOfWeek, parseDaysOfWeek } from "@/lib/time";

type RouteContext = { params: Promise<{ id: string }> };

function parseRouteWaypointsBody(value: unknown): RouteWaypoint[] | string {
  if (value == null) return [];
  if (!Array.isArray(value)) return "routeWaypoints must be an array";

  const drafts: RouteWaypointDraft[] = value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return { latitude: "", longitude: "" };
    }
    const waypoint = entry as { latitude?: unknown; longitude?: unknown };
    return {
      latitude: String(waypoint.latitude ?? ""),
      longitude: String(waypoint.longitude ?? ""),
    };
  });

  return draftsToWaypoints(drafts);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    active?: boolean;
    daysOfWeek?: string;
    routeWaypoints?: Array<{ latitude: number | string; longitude: number | string }> | null;
  };

  if (body.daysOfWeek !== undefined) {
    const days = parseDaysOfWeek(body.daysOfWeek);
    if (days.length === 0) {
      return NextResponse.json({ error: "Select at least one day" }, { status: 400 });
    }

    await prisma.pairScheduleSlot.updateMany({
      where: { trackedPairId: id },
      data: { daysOfWeek: formatDaysOfWeek(days) },
    });
  }

  let routeWaypointsJson: string | null | undefined;
  if (body.routeWaypoints !== undefined) {
    const parsed = parseRouteWaypointsBody(body.routeWaypoints);
    if (typeof parsed === "string") {
      return NextResponse.json({ error: parsed }, { status: 400 });
    }
    routeWaypointsJson = serializeRouteWaypoints(parsed);
  }

  const pair = await prisma.trackedPair.update({
    where: { id },
    data: {
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(routeWaypointsJson !== undefined ? { routeWaypointsJson } : {}),
    },
    include: {
      originLocation: true,
      destinationLocation: true,
      scheduleSlots: { orderBy: { timeLocal: "asc" } },
    },
  });

  return NextResponse.json(pair);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await prisma.trackedPair.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
