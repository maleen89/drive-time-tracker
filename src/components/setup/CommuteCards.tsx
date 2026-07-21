"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCommuteWeekdays, getPairWeekdays } from "@/components/setup/commute-days";
import { DirectionScheduleEditor } from "@/components/setup/DirectionScheduleEditor";
import {
  RouteWaypointEditor,
  RouteWaypointSummary,
} from "@/components/setup/RouteWaypointEditor";
import type { TrackedPairData } from "@/components/setup/types";
import { WeekdaySelector } from "@/components/setup/WeekdaySelector";
import {
  formatSlotList,
  getCommuteDirection,
  type CommuteRouteGroup,
  pairLabel,
} from "@/lib/tracked-pairs";
import { formatCommuteDirection } from "@/lib/commute";
import { formatDaysOfWeek, formatDaysOfWeekLabel } from "@/lib/time";

function slotSummary(pair: TrackedPairData | null | undefined): string {
  if (!pair) return "—";
  const times = pair.scheduleSlots.filter((slot) => slot.active).map((slot) => slot.timeLocal);
  return times.length > 0 ? formatSlotList(times) : "—";
}

export function CommuteRouteCard({ group }: { group: CommuteRouteGroup<TrackedPairData> }) {
  const router = useRouter();
  const [slotError, setSlotError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftDays, setDraftDays] = useState<number[]>(() => getCommuteWeekdays(group));

  const pairIds = [group.toWorkPair?.id, group.fromWorkPair?.id].filter(Boolean) as string[];
  const savedDays = getCommuteWeekdays(group);
  const daysLabel = formatDaysOfWeekLabel(formatDaysOfWeek(savedDays));

  useEffect(() => {
    if (!editing) {
      setDraftDays(savedDays);
    }
  }, [editing, savedDays.join(",")]);

  const isActive =
    (group.toWorkPair?.active ?? true) && (group.fromWorkPair?.active ?? true);

  async function saveDays(days: number[]) {
    const responses = await Promise.all(
      pairIds.map((pairId) =>
        fetch(`/api/tracked-pairs/${pairId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daysOfWeek: formatDaysOfWeek(days) }),
        }),
      ),
    );
    if (responses.some((response) => !response.ok)) {
      const data = await responses.find((response) => !response.ok)!.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update days");
    }
  }

  async function finishEditing() {
    setDayError(null);
    setSaving(true);
    try {
      if (formatDaysOfWeek(draftDays) !== formatDaysOfWeek(savedDays)) {
        await saveDays(draftDays);
        router.refresh();
      }
      setEditing(false);
    } catch (error) {
      setDayError(error instanceof Error ? error.message : "Failed to update days");
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setDraftDays(savedDays);
    setDayError(null);
    setSlotError(null);
    setEditing(true);
  }

  async function toggleActive() {
    const nextActive = !isActive;
    await Promise.all(
      [group.toWorkPair, group.fromWorkPair]
        .filter(Boolean)
        .map((pair) =>
          fetch(`/api/tracked-pairs/${pair!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: nextActive }),
          }),
        ),
    );
    router.refresh();
  }

  async function removeCommute() {
    if (!confirm(`Delete commutes for ${group.home.label}?`)) return;
    await Promise.all(
      [group.toWorkPair, group.fromWorkPair]
        .filter(Boolean)
        .map((pair) => fetch(`/api/tracked-pairs/${pair!.id}`, { method: "DELETE" })),
    );
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="font-medium">
            {group.home.label} ↔ {group.work.label}
          </h3>
          {!editing && (
            <div className="text-sm text-slate-600">
              <p>
                <span className="font-medium text-slate-700">Days:</span> {daysLabel}
              </p>
              <p>
                <span className="font-medium text-slate-700">Morning:</span>{" "}
                {slotSummary(group.toWorkPair)}
                {group.toWorkPair && (
                  <>
                    {" "}
                    · <RouteWaypointSummary pair={group.toWorkPair} inline />
                  </>
                )}
              </p>
              <p>
                <span className="font-medium text-slate-700">Evening:</span>{" "}
                {slotSummary(group.fromWorkPair)}
                {group.fromWorkPair && (
                  <>
                    {" "}
                    · <RouteWaypointSummary pair={group.fromWorkPair} inline />
                  </>
                )}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => (editing ? finishEditing() : startEditing())}
            disabled={saving}
            className="text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Done" : "Edit times"}
          </button>
          <button type="button" onClick={toggleActive} className="text-slate-600 hover:text-slate-900">
            {isActive ? "Pause" : "Activate"}
          </button>
          <button type="button" onClick={removeCommute} className="text-red-600 hover:text-red-800">
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <WeekdaySelector selected={draftDays} onChange={setDraftDays} disabled={saving} />
          <div className="grid gap-3 md:grid-cols-2">
            {group.toWorkPair && (
              <div className="space-y-3">
                <DirectionScheduleEditor
                  label="Morning"
                  pair={group.toWorkPair}
                  onError={setSlotError}
                />
                <RouteWaypointEditor pair={group.toWorkPair} onError={setSlotError} />
              </div>
            )}
            {group.fromWorkPair && (
              <div className="space-y-3">
                <DirectionScheduleEditor
                  label="Evening"
                  pair={group.fromWorkPair}
                  onError={setSlotError}
                />
                <RouteWaypointEditor pair={group.fromWorkPair} onError={setSlotError} />
              </div>
            )}
          </div>
        </div>
      )}

      {dayError && <p className="mt-2 text-sm text-red-600">{dayError}</p>}
      {slotError && <p className="mt-2 text-sm text-red-600">{slotError}</p>}
    </div>
  );
}

export function DirectionPairCard({ pair }: { pair: TrackedPairData }) {
  const router = useRouter();
  const direction = getCommuteDirection(pair);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftDays, setDraftDays] = useState<number[]>(() => getPairWeekdays(pair));
  const savedDays = getPairWeekdays(pair);
  const daysLabel = formatDaysOfWeekLabel(formatDaysOfWeek(savedDays));

  useEffect(() => {
    if (!editing) {
      setDraftDays(savedDays);
    }
  }, [editing, savedDays.join(",")]);

  async function saveDays(days: number[]) {
    const response = await fetch(`/api/tracked-pairs/${pair.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysOfWeek: formatDaysOfWeek(days) }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update days");
    }
  }

  async function finishEditing() {
    setDayError(null);
    setSaving(true);
    try {
      if (formatDaysOfWeek(draftDays) !== formatDaysOfWeek(savedDays)) {
        await saveDays(draftDays);
        router.refresh();
      }
      setEditing(false);
    } catch (error) {
      setDayError(error instanceof Error ? error.message : "Failed to update days");
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setDraftDays(savedDays);
    setDayError(null);
    setSlotError(null);
    setEditing(true);
  }

  async function toggleActive() {
    await fetch(`/api/tracked-pairs/${pair.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !pair.active }),
    });
    router.refresh();
  }

  async function removePair() {
    if (!confirm("Delete this pair and its measurements?")) return;
    await fetch(`/api/tracked-pairs/${pair.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium">{pairLabel(pair)}</h3>
          <p className="text-sm text-slate-600">
            {formatCommuteDirection(direction)}
            {!editing && (
              <>
                {" "}
                · Days: {daysLabel} · {slotSummary(pair)}
              </>
            )}
          </p>
          {!editing && <RouteWaypointSummary pair={pair} />}
        </div>
        <div className="flex gap-3 text-sm">
          <button
            type="button"
            onClick={() => (editing ? finishEditing() : startEditing())}
            disabled={saving}
            className="text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Done" : "Edit times"}
          </button>
          <button type="button" onClick={toggleActive} className="text-slate-600 hover:text-slate-900">
            {pair.active ? "Pause" : "Activate"}
          </button>
          <button type="button" onClick={removePair} className="text-red-600 hover:text-red-800">
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3">
          <WeekdaySelector selected={draftDays} onChange={setDraftDays} disabled={saving} />
          <DirectionScheduleEditor label="Schedule" pair={pair} onError={setSlotError} />
          <RouteWaypointEditor pair={pair} onError={setSlotError} />
        </div>
      )}
      {dayError && <p className="mt-2 text-sm text-red-600">{dayError}</p>}
      {slotError && <p className="mt-2 text-sm text-red-600">{slotError}</p>}
    </div>
  );
}
