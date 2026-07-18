import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  DEFAULT_AFTERNOON_SLOTS,
  DEFAULT_MORNING_SLOTS,
  defaultSlotsForPair,
} from "@/lib/tracked-pairs";
import { DEFAULT_WEEKDAYS, formatDaysOfWeek, parseDaysOfWeek } from "@/lib/time";

const pairInclude = {
  originLocation: true,
  destinationLocation: true,
  scheduleSlots: { orderBy: { timeLocal: "asc" as const } },
};

function slotCreates(times: string[], daysOfWeek: string) {
  return times.map((timeLocal) => ({
    timeLocal,
    daysOfWeek,
    timezone: "America/Los_Angeles",
    active: true,
  }));
}

async function createPair(
  originLocationId: string,
  destinationLocationId: string,
  timeLocals: string[],
  daysOfWeek: string,
) {
  return prisma.trackedPair.create({
    data: {
      originLocationId,
      destinationLocationId,
      scheduleSlots: {
        create: slotCreates(timeLocals, daysOfWeek),
      },
    },
    include: pairInclude,
  });
}

export async function GET() {
  const pairs = await prisma.trackedPair.findMany({
    orderBy: { createdAt: "asc" },
    include: pairInclude,
  });
  return NextResponse.json(pairs);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    originLocationId?: string;
    destinationLocationId?: string;
    homeLocationId?: string;
    morningSlots?: string[];
    eveningSlots?: string[];
    timeLocals?: string[];
    daysOfWeek?: string;
  };

  function resolveDaysOfWeek(value: string | undefined): string {
    const days = parseDaysOfWeek(value ?? DEFAULT_WEEKDAYS);
    if (days.length === 0) {
      throw new Error("Select at least one day");
    }
    return formatDaysOfWeek(days);
  }

  if (body.homeLocationId) {
    const work = await prisma.location.findFirst({ where: { isWork: true } });
    const home = await prisma.location.findUnique({ where: { id: body.homeLocationId } });

    if (!work) {
      return NextResponse.json({ error: "Mark a work location first" }, { status: 400 });
    }
    if (!home || home.isWork) {
      return NextResponse.json({ error: "Choose a home location" }, { status: 400 });
    }

    const morningSlots = body.morningSlots ?? DEFAULT_MORNING_SLOTS;
    const eveningSlots = body.eveningSlots ?? DEFAULT_AFTERNOON_SLOTS;

    if (morningSlots.length === 0 && eveningSlots.length === 0) {
      return NextResponse.json(
        { error: "Select at least one morning or evening time" },
        { status: 400 },
      );
    }

    const [existingToWork, existingFromWork] = await Promise.all([
      prisma.trackedPair.findUnique({
        where: {
          originLocationId_destinationLocationId: {
            originLocationId: home.id,
            destinationLocationId: work.id,
          },
        },
      }),
      prisma.trackedPair.findUnique({
        where: {
          originLocationId_destinationLocationId: {
            originLocationId: work.id,
            destinationLocationId: home.id,
          },
        },
      }),
    ]);

    if (morningSlots.length > 0 && existingToWork) {
      return NextResponse.json(
        { error: `${home.label} → ${work.label} is already tracked` },
        { status: 400 },
      );
    }
    if (eveningSlots.length > 0 && existingFromWork) {
      return NextResponse.json(
        { error: `${work.label} → ${home.label} is already tracked` },
        { status: 400 },
      );
    }

    try {
      const daysOfWeek = resolveDaysOfWeek(body.daysOfWeek);
      const created = await Promise.all([
        morningSlots.length > 0
          ? createPair(home.id, work.id, morningSlots, daysOfWeek)
          : Promise.resolve(null),
        eveningSlots.length > 0
          ? createPair(work.id, home.id, eveningSlots, daysOfWeek)
          : Promise.resolve(null),
      ]);

      return NextResponse.json(
        {
          toWorkPair: created[0],
          fromWorkPair: created[1],
        },
        { status: 201 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create commute pair";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (!body.originLocationId || !body.destinationLocationId) {
    return NextResponse.json(
      { error: "Origin and destination locations are required" },
      { status: 400 },
    );
  }

  if (body.originLocationId === body.destinationLocationId) {
    return NextResponse.json(
      { error: "Origin and destination must be different" },
      { status: 400 },
    );
  }

  const [origin, destination] = await Promise.all([
    prisma.location.findUnique({ where: { id: body.originLocationId } }),
    prisma.location.findUnique({ where: { id: body.destinationLocationId } }),
  ]);

  if (!origin || !destination) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const pairStub = {
    id: "new",
    active: true,
    originLocation: origin,
    destinationLocation: destination,
  };
  const slots = body.timeLocals?.length
    ? body.timeLocals
    : defaultSlotsForPair(pairStub);

  try {
    const daysOfWeek = resolveDaysOfWeek(body.daysOfWeek);
    const pair = await createPair(
      body.originLocationId,
      body.destinationLocationId,
      slots,
      daysOfWeek,
    );
    return NextResponse.json(pair, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "This pair already exists";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
