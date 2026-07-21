import { SetupPanel } from "@/components/setup/SetupPanel";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [locations, pairs] = await Promise.all([
    prisma.location.findMany({ orderBy: { label: "asc" } }),
    prisma.trackedPair.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        originLocation: true,
        destinationLocation: true,
        scheduleSlots: { orderBy: { timeLocal: "asc" } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage locations and configure tracked commute pairs with per-pair schedules. For an
          alternate route (e.g. via an expressway), add a second home location with the same
          address and a distinct label, then set route waypoints on that commute.
        </p>
      </div>
      <SetupPanel locations={locations} pairs={pairs} />
    </div>
  );
}
