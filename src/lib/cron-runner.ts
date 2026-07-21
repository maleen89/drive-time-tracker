import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { fetchDrivingRoute } from "@/lib/google-maps";
import {
  CommutePeriod,
  getCommutePeriodNow,
  pairRunsInPeriod,
} from "@/lib/commute";
import {
  getCommuteDirection,
  pairAddresses,
  pairLabel,
} from "@/lib/tracked-pairs";
import { parseRouteWaypoints } from "@/lib/route-waypoints";
import {
  buildScheduledDepartureAt,
  DEFAULT_TIMEZONE,
  slotMatchesNow,
} from "@/lib/time";

export interface CronRunResult {
  slotsChecked: number;
  pairsChecked: number;
  created: number;
  skipped: number;
  errors: number;
  message?: string;
  details: Array<{
    pairLabel: string;
    slotTime: string;
    status: string;
    message?: string;
  }>;
}

const pairInclude = {
  originLocation: true,
  destinationLocation: true,
  scheduleSlots: { where: { active: true }, orderBy: { timeLocal: "asc" as const } },
};

type PairRecord = Awaited<
  ReturnType<typeof prisma.trackedPair.findMany<{ include: typeof pairInclude }>>
>[number];

type SlotRecord = PairRecord["scheduleSlots"][number];

export async function runScheduledMeasurements(
  now = new Date(),
  toleranceMinutes = 5,
  force = false,
  manualPeriod?: CommutePeriod,
): Promise<CronRunResult> {
  const activePairs = await prisma.trackedPair.findMany({
    where: { active: true },
    include: pairInclude,
  });

  const result: CronRunResult = {
    slotsChecked: activePairs.reduce((sum, pair) => sum + pair.scheduleSlots.length, 0),
    pairsChecked: activePairs.length,
    created: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  if (force) {
    const period = manualPeriod ?? getCommutePeriodNow(now);
    const pairsToRun = activePairs.filter((pair) =>
      pairRunsInPeriod(getCommuteDirection(pair), period),
    );

    if (!period) {
      result.message =
        "Outside commute hours (7–10 AM home→work, 2–6 PM work→home). Nothing to run.";
      return result;
    }

    if (pairsToRun.length === 0) {
      result.message = `No active ${period === "morning" ? "home → work" : "work → home"} pairs to run.`;
      return result;
    }

    for (const pair of pairsToRun) {
      await recordMeasurement({
        pair,
        scheduleSlot: null,
        scheduledDepartureAt: now,
        result,
      });
    }
    return result;
  }

  for (const pair of activePairs) {
    for (const slot of pair.scheduleSlots) {
      const timeZone = slot.timezone || DEFAULT_TIMEZONE;
      if (!slotMatchesNow(now, slot.timeLocal, slot.daysOfWeek, timeZone, toleranceMinutes)) {
        continue;
      }

      const scheduledDepartureAt =
        buildScheduledDepartureAt(now, slot.timeLocal, timeZone) ?? now;

      await recordMeasurement({
        pair,
        scheduleSlot: slot,
        scheduledDepartureAt,
        result,
      });
    }
  }

  return result;
}

async function recordMeasurement({
  pair,
  scheduleSlot,
  scheduledDepartureAt,
  result,
}: {
  pair: PairRecord;
  scheduleSlot: SlotRecord | null;
  scheduledDepartureAt: Date;
  result: CronRunResult;
}) {
  const label = pairLabel(pair);
  const { originAddress, destinationAddress } = pairAddresses(pair);

  const existing = await findExistingMeasurement(
    pair.id,
    scheduleSlot?.id ?? null,
    scheduledDepartureAt,
  );

  if (existing) {
    result.skipped += 1;
    return;
  }

  const route = await fetchDrivingRoute(
    originAddress,
    destinationAddress,
    scheduledDepartureAt,
    parseRouteWaypoints(pair.routeWaypointsJson),
  );

  const durationInTraffic =
    route.durationInTrafficSeconds ?? route.durationSeconds;

  try {
    await prisma.measurement.create({
      data: {
        trackedPairId: pair.id,
        pairScheduleSlotId: scheduleSlot?.id ?? null,
        scheduledDepartureAt,
        durationSeconds: route.durationSeconds,
        durationInTrafficSeconds: durationInTraffic,
        distanceMeters: route.distanceMeters,
        routePolyline: route.routePolyline,
        routeTrafficJson: route.routeTrafficJson,
        status: route.status,
        errorMessage: route.errorMessage,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      result.skipped += 1;
      return;
    }
    throw error;
  }

  if (route.status === "OK") {
    result.created += 1;
    result.details.push({
      pairLabel: label,
      slotTime: scheduleSlot?.timeLocal ?? "now",
      status: "OK",
    });
  } else {
    result.errors += 1;
    result.details.push({
      pairLabel: label,
      slotTime: scheduleSlot?.timeLocal ?? "now",
      status: route.status,
      message: route.errorMessage ?? undefined,
    });
  }
}

async function findExistingMeasurement(
  trackedPairId: string,
  pairScheduleSlotId: string | null,
  scheduledDepartureAt: Date,
) {
  if (pairScheduleSlotId) {
    return prisma.measurement.findUnique({
      where: {
        trackedPairId_pairScheduleSlotId_scheduledDepartureAt: {
          trackedPairId,
          pairScheduleSlotId,
          scheduledDepartureAt,
        },
      },
    });
  }

  return prisma.measurement.findFirst({
    where: {
      trackedPairId,
      pairScheduleSlotId: null,
      scheduledDepartureAt,
    },
  });
}