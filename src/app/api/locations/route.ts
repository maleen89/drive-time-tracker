import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const locations = await prisma.location.findMany({ orderBy: { label: "asc" } });
  return NextResponse.json(locations);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    label?: string;
    address?: string;
    isWork?: boolean;
  };

  if (!body.label?.trim() || !body.address?.trim()) {
    return NextResponse.json(
      { error: "Label and address are required" },
      { status: 400 },
    );
  }

  if (body.isWork) {
    await prisma.location.updateMany({ data: { isWork: false } });
  }

  const location = await prisma.location.create({
    data: {
      label: body.label.trim(),
      address: body.address.trim(),
      isWork: body.isWork ?? false,
    },
  });

  return NextResponse.json(location, { status: 201 });
}
