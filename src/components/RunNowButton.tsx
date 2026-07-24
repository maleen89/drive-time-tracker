"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getBinnedTimeFromDate,
  queuePendingSummaryColumn,
} from "@/lib/home-commute-summary";
import { DEFAULT_TIMEZONE, getLocalDateKey } from "@/lib/time";

type ManualPeriod = "morning" | "afternoon";

export function RunNowButton() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<ManualPeriod | null>(null);

  async function handleRun(period: ManualPeriod) {
    setError(null);
    setStatus(null);
    setLoading(period);

    try {
      const response = await fetch(`/api/run-now?period=${period}`, { method: "POST" });

      let data: {
        error?: string;
        message?: string;
        created?: number;
        skipped?: number;
        errors?: number;
        details?: Array<{ status: string; message?: string }>;
      } = {};

      try {
        data = await response.json();
      } catch {
        setError(
          response.ok
            ? "Unexpected server response."
            : `Server error (${response.status}). Check the terminal running npm run dev.`,
        );
        return;
      }

      if (!response.ok) {
        setError(data.error ?? `Run failed (${response.status})`);
        return;
      }

      if ((data.created ?? 0) === 0 && data.message) {
        setError(data.message);
        return;
      }

      const label = period === "morning" ? "Morning" : "Evening";
      setStatus(
        `${label}: ${data.created ?? 0} created, ${data.skipped ?? 0} skipped, ${data.errors ?? 0} errors. Check the newest column in Commute summary.`,
      );

      if ((data.created ?? 0) > 0) {
        queuePendingSummaryColumn(
          period === "morning" ? "morning" : "evening",
          getLocalDateKey(new Date(), DEFAULT_TIMEZONE),
          getBinnedTimeFromDate(new Date()),
        );
      }

      if (data.errors && data.errors > 0) {
        const firstError = data.details?.find((d) => d.status !== "OK");
        if (firstError?.message) {
          setError(firstError.message);
        }
      }

      router.refresh();
    } catch {
      setError("Network error. Confirm npm run dev is running and you are on http://localhost:3000");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-2">
      <p className="text-sm font-medium text-slate-700">Manual test</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handleRun("morning")}
          disabled={loading !== null}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading === "morning" ? "Running…" : "Run morning"}
        </button>
        <button
          type="button"
          onClick={() => handleRun("afternoon")}
          disabled={loading !== null}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading === "afternoon" ? "Running…" : "Run evening"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Morning = home → work. Evening = work → home. Uses current traffic.
      </p>
      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
