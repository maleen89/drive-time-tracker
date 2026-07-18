import { AddCommuteForm } from "@/components/setup/AddCommuteForm";
import { CommuteRouteCard, DirectionPairCard } from "@/components/setup/CommuteCards";
import { LocationsSection } from "@/components/setup/LocationsSection";
import type { LocationData, TrackedPairData } from "@/components/setup/types";
import { getOrphanPairs, groupPairsIntoCommuteRoutes } from "@/lib/tracked-pairs";

export type { LocationData, TrackedPairData } from "@/components/setup/types";

interface SetupPanelProps {
  locations: LocationData[];
  pairs: TrackedPairData[];
}

export function SetupPanel({ locations, pairs }: SetupPanelProps) {
  const commuteGroups = groupPairsIntoCommuteRoutes(pairs, locations);
  const orphanPairs = getOrphanPairs(pairs, commuteGroups);

  return (
    <div className="space-y-10">
      <LocationsSection locations={locations} />
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Tracked commutes</h2>
          <p className="text-sm text-slate-600">
            Each home location tracks morning and evening drive times to the work address.
          </p>
        </div>

        <div className="space-y-3">
          {commuteGroups.map((group) => (
            <CommuteRouteCard key={group.key} group={group} />
          ))}
          {orphanPairs.map((pair) => (
            <DirectionPairCard key={pair.id} pair={pair} />
          ))}
        </div>

        <AddCommuteForm locations={locations} commuteGroups={commuteGroups} />
      </section>
    </div>
  );
}
