"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { TrackedPairData } from "@/components/setup/types";

export function DirectionScheduleEditor({
  label,
  pair,
  onError,
}: {
  label: string;
  pair: TrackedPairData;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const [newTime, setNewTime] = useState("");
  const activeSlots = pair.scheduleSlots.filter((slot) => slot.active);

  async function addSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError(null);
    const response = await fetch(`/api/tracked-pairs/${pair.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeLocal: newTime }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      onError(data.error ?? "Failed to add time");
      return;
    }
    setNewTime("");
    router.refresh();
  }

  async function removeSlot(slotId: string) {
    onError(null);
    await fetch(`/api/pair-slots/${slotId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {activeSlots.map((slot) => (
          <span
            key={slot.id}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-slate-200"
          >
            {slot.timeLocal}
            <button
              type="button"
              onClick={() => removeSlot(slot.id)}
              className="text-slate-500 hover:text-red-600"
              aria-label={`Remove ${slot.timeLocal}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={addSlot} className="mt-2 flex items-center gap-2">
        <input
          value={newTime}
          onChange={(event) => setNewTime(event.target.value)}
          placeholder="HH:MM"
          pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
          className="w-20 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
        />
        <button type="submit" className="rounded bg-slate-800 px-2 py-1 text-xs text-white">
          Add
        </button>
      </form>
    </div>
  );
}
