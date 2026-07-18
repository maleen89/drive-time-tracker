import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatDaysOfWeek, parseDaysOfWeek } from "@/lib/time";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { active?: boolean; daysOfWeek?: string };

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

  const pair = await prisma.trackedPair.update({
    where: { id },
    data: {
      ...(body.active !== undefined ? { active: body.active } : {}),
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
