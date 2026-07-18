import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const trackedPairId = request.nextUrl.searchParams.get("trackedPairId");
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Number(limitParam), 5000) : 500;

  const measurements = await prisma.measurement.findMany({
    where: trackedPairId ? { trackedPairId } : undefined,
    orderBy: { scheduledDepartureAt: "desc" },
    take: Number.isFinite(limit) ? limit : 500,
    include: {
      trackedPair: { include: { originLocation: true, destinationLocation: true } },
      pairScheduleSlot: true,
    },
  });

  return NextResponse.json(measurements);
}
