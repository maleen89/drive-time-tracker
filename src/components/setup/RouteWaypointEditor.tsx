"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrackedPairData } from "@/components/setup/types";
import {
  draftsToWaypoints,
  parseRouteWaypoints,
  waypointsToDrafts,
  type RouteWaypointDraft,
} from "@/lib/route-waypoints";

function emptyDraft(): RouteWaypointDraft {
  return { latitude: "", longitude: "" };
}

export function RouteWaypointEditor({
  pair,
  onError,
}: {
  pair: TrackedPairData;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<RouteWaypointDraft[]>(() =>
    waypointsToDrafts(parseRouteWaypoints(pair.routeWaypointsJson)),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDrafts(waypointsToDrafts(parseRouteWaypoints(pair.routeWaypointsJson)));
  }, [pair.id, pair.routeWaypointsJson]);

  function updateDraft(index: number, field: keyof RouteWaypointDraft, value: string) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  async function saveWaypoints() {
    onError(null);
    const parsed = draftsToWaypoints(drafts);
    if (typeof parsed === "string") {
      onError(parsed);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/tracked-pairs/${pair.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeWaypoints: parsed }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(data.error ?? "Failed to save waypoints");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function clearWaypoints() {
    onError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/tracked-pairs/${pair.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeWaypoints: [] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(data.error ?? "Failed to clear waypoints");
        return;
      }
      setDrafts([]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-slate-100 bg-white p-3">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Route waypoints
        </p>
        <p className="text-xs text-slate-500">
          Optional pass-through points (lat/long). The route must visit each in order — useful
          for forcing an expressway segment. Leave empty for Google&apos;s default route.
        </p>
      </div>

      {drafts.length > 0 && (
        <div className="mt-3 space-y-2">
          {drafts.map((draft, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <span className="w-5 text-xs text-slate-400">{index + 1}.</span>
              <input
                value={draft.latitude}
                onChange={(event) => updateDraft(index, "latitude", event.target.value)}
                placeholder="Latitude"
                inputMode="decimal"
                className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
              />
              <input
                value={draft.longitude}
                onChange={(event) => updateDraft(index, "longitude", event.target.value)}
                placeholder="Longitude"
                inputMode="decimal"
                className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDrafts((current) => [...current, emptyDraft()])}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          Add waypoint
        </button>
        <button
          type="button"
          onClick={saveWaypoints}
          disabled={saving}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save waypoints"}
        </button>
        {drafts.length > 0 && (
          <button
            type="button"
            onClick={clearWaypoints}
            disabled={saving}
            className="rounded px-2 py-1 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

export function RouteWaypointSummary({
  pair,
  inline = false,
}: {
  pair: TrackedPairData;
  inline?: boolean;
}) {
  const count = parseRouteWaypoints(pair.routeWaypointsJson).length;
  if (count === 0) return inline ? <>default route</> : null;

  const label = count === 1 ? "1 waypoint" : `${count} waypoints`;
  if (inline) {
    return <span className="text-slate-500">{label}</span>;
  }

  return <p className="text-xs text-slate-500">Route via {label}</p>;
}
