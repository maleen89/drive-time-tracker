import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    label?: string;
    address?: string;
    isWork?: boolean;
  };

  if (body.isWork) {
    await prisma.location.updateMany({
      where: { id: { not: id } },
      data: { isWork: false },
    });
  }

  const location = await prisma.location.update({
    where: { id },
    data: {
      ...(body.label !== undefined ? { label: body.label.trim() } : {}),
      ...(body.address !== undefined ? { address: body.address.trim() } : {}),
      ...(body.isWork !== undefined ? { isWork: body.isWork } : {}),
    },
  });

  return NextResponse.json(location);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const pairCount = await prisma.trackedPair.count({
    where: {
      OR: [{ originLocationId: id }, { destinationLocationId: id }],
    },
  });

  if (pairCount > 0) {
    return NextResponse.json(
      { error: "Remove tracked pairs using this location first." },
      { status: 400 },
    );
  }

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
