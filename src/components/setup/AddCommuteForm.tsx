"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_AFTERNOON_SLOTS,
  DEFAULT_MORNING_SLOTS,
  type CommuteRouteGroup,
} from "@/lib/tracked-pairs";
import type { LocationData } from "@/components/setup/types";
import { WeekdaySelector } from "@/components/setup/WeekdaySelector";
import { DEFAULT_WEEKDAYS, formatDaysOfWeek, parseDaysOfWeek } from "@/lib/time";

function SlotCheckboxGrid({
  label,
  times,
  selected,
  onToggle,
}: {
  label: string;
  times: readonly string[];
  selected: string[];
  onToggle: (time: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {times.map((time) => (
          <label
            key={time}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs"
          >
            <input
              type="checkbox"
              checked={selected.includes(time)}
              onChange={() => onToggle(time)}
            />
            {time}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddCommuteForm({
  locations,
  commuteGroups,
}: {
  locations: LocationData[];
  commuteGroups: CommuteRouteGroup[];
}) {
  const router = useRouter();
  const work = locations.find((location) => location.isWork);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [homeLocationId, setHomeLocationId] = useState("");
  const [morningSlots, setMorningSlots] = useState<string[]>([...DEFAULT_MORNING_SLOTS]);
  const [eveningSlots, setEveningSlots] = useState<string[]>([...DEFAULT_AFTERNOON_SLOTS]);
  const [weekdays, setWeekdays] = useState<number[]>(parseDaysOfWeek(DEFAULT_WEEKDAYS));

  const availableHomes = useMemo(() => {
    return locations.filter((location) => {
      if (location.isWork) return false;
      const group = commuteGroups.find((entry) => entry.home.id === location.id);
      if (!group) return true;
      return !group.toWorkPair || !group.fromWorkPair;
    });
  }, [locations, commuteGroups]);

  const selectedGroup = commuteGroups.find((group) => group.home.id === homeLocationId);
  const includeMorning = !selectedGroup?.toWorkPair;
  const includeEvening = !selectedGroup?.fromWorkPair;

  function toggleSlot(time: string, period: "morning" | "evening") {
    if (period === "morning") {
      setMorningSlots((slots) =>
        slots.includes(time) ? slots.filter((value) => value !== time) : [...slots, time],
      );
      return;
    }
    setEveningSlots((slots) =>
      slots.includes(time) ? slots.filter((value) => value !== time) : [...slots, time],
    );
  }

  async function addCommute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tracked-pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeLocationId,
          morningSlots: includeMorning ? morningSlots : [],
          eveningSlots: includeEvening ? eveningSlots : [],
          daysOfWeek: formatDaysOfWeek(weekdays),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Failed to add commute");
        return;
      }
      setHomeLocationId("");
      setMorningSlots([...DEFAULT_MORNING_SLOTS]);
      setEveningSlots([...DEFAULT_AFTERNOON_SLOTS]);
      setWeekdays(parseDaysOfWeek(DEFAULT_WEEKDAYS));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!work || locations.length < 2) {
    return (
      <p className="text-sm text-slate-500">
        Add at least two locations and mark one as work to create commutes.
      </p>
    );
  }

  if (availableHomes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Every home location already has morning and evening commutes configured.
      </p>
    );
  }

  return (
    <form onSubmit={addCommute} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">Home location</span>
          <select
            required
            value={homeLocationId}
            onChange={(event) => setHomeLocationId(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Choose home…</option>
            {availableHomes.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-slate-600 md:flex md:items-end">
          Work: <span className="md:ml-1 md:font-medium">{work.label}</span>
        </div>
      </div>

      {homeLocationId && (
        <div className="space-y-3">
          <WeekdaySelector selected={weekdays} onChange={setWeekdays} />
          {includeMorning && (
            <SlotCheckboxGrid
              label="Morning times (home → work)"
              times={DEFAULT_MORNING_SLOTS}
              selected={morningSlots}
              onToggle={(time) => toggleSlot(time, "morning")}
            />
          )}
          {includeEvening && (
            <SlotCheckboxGrid
              label="Evening times (work → home)"
              times={DEFAULT_AFTERNOON_SLOTS}
              selected={eveningSlots}
              onToggle={(time) => toggleSlot(time, "evening")}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !homeLocationId}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Adding…" : "Add commute"}
      </button>
    </form>
  );
}
