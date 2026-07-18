import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseTimeLocal } from "@/lib/time";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    timeLocal?: string;
    daysOfWeek?: string;
    active?: boolean;
  };

  if (body.timeLocal && !parseTimeLocal(body.timeLocal)) {
    return NextResponse.json(
      { error: "timeLocal must be HH:MM in 24-hour format" },
      { status: 400 },
    );
  }

  const slot = await prisma.pairScheduleSlot.update({
    where: { id },
    data: {
      ...(body.timeLocal !== undefined ? { timeLocal: body.timeLocal.trim() } : {}),
      ...(body.daysOfWeek !== undefined ? { daysOfWeek: body.daysOfWeek } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });

  return NextResponse.json(slot);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await prisma.pairScheduleSlot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
