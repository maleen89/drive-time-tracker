import { PrismaClient } from "@prisma/client";
import { DEFAULT_AFTERNOON_SLOTS, DEFAULT_MORNING_SLOTS } from "../src/lib/tracked-pairs";

const prisma = new PrismaClient();

const LOCATIONS = [
  {
    label: "Work",
    address: "690 E Middlefield Ave, Mountain View, CA",
    isWork: true,
  },
  {
    label: "Fremont",
    address: "2748 Pismo Ter, Fremont, CA",
    isWork: false,
  },
  {
    label: "Dublin",
    address: "7420 Hansen Dr, Dublin, CA 94568",
    isWork: false,
  },
];

async function main() {
  await prisma.measurement.deleteMany();
  await prisma.pairScheduleSlot.deleteMany();
  await prisma.trackedPair.deleteMany();
  await prisma.location.deleteMany();

  const createdLocations = await Promise.all(
    LOCATIONS.map((location) => prisma.location.create({ data: location })),
  );

  const byLabel = Object.fromEntries(createdLocations.map((loc) => [loc.label, loc]));

  const pairDefs = [
    {
      origin: "Fremont",
      destination: "Work",
      slots: DEFAULT_MORNING_SLOTS,
    },
    {
      origin: "Work",
      destination: "Fremont",
      slots: DEFAULT_AFTERNOON_SLOTS,
    },
    {
      origin: "Dublin",
      destination: "Work",
      slots: DEFAULT_MORNING_SLOTS,
    },
    {
      origin: "Work",
      destination: "Dublin",
      slots: DEFAULT_AFTERNOON_SLOTS,
    },
  ];

  for (const def of pairDefs) {
    const pair = await prisma.trackedPair.create({
      data: {
        originLocationId: byLabel[def.origin].id,
        destinationLocationId: byLabel[def.destination].id,
        scheduleSlots: {
          create: def.slots.map((timeLocal) => ({
            timeLocal,
            daysOfWeek: "1,2,3,4,5",
            timezone: "America/Los_Angeles",
            active: true,
          })),
        },
      },
    });
    console.log(`Created pair ${def.origin} → ${def.destination} (${pair.id})`);
  }

  console.log(`Seeded ${createdLocations.length} locations and ${pairDefs.length} tracked pairs`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
