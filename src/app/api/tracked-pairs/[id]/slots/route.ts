import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_WEEKDAYS, DEFAULT_TIMEZONE, parseTimeLocal } from "@/lib/time";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: trackedPairId } = await context.params;
  const body = (await request.json()) as { timeLocal?: string; daysOfWeek?: string };

  if (!body.timeLocal || !parseTimeLocal(body.timeLocal)) {
    return NextResponse.json(
      { error: "timeLocal must be HH:MM in 24-hour format" },
      { status: 400 },
    );
  }

  const existingSlot = await prisma.pairScheduleSlot.findFirst({
    where: { trackedPairId },
    orderBy: { timeLocal: "asc" },
  });
  const daysOfWeek = body.daysOfWeek ?? existingSlot?.daysOfWeek ?? DEFAULT_WEEKDAYS;

  try {
    const slot = await prisma.pairScheduleSlot.create({
      data: {
        trackedPairId,
        timeLocal: body.timeLocal.trim(),
        daysOfWeek,
        timezone: DEFAULT_TIMEZONE,
        active: true,
      },
    });
    return NextResponse.json(slot, { status: 201 });
  } catch {
    return NextResponse.json({ error: "This time slot already exists for the pair" }, { status: 400 });
  }
}
