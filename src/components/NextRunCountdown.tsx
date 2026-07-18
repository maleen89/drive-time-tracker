"use client";

import { useEffect, useState } from "react";
import {
  formatCountdown,
  formatNextRunLabel,
  type NextScheduleRun,
} from "@/lib/schedule-utils";

interface NextRunCountdownProps {
  nextRun: NextScheduleRun | null;
}

export function NextRunCountdown({ nextRun }: NextRunCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!nextRun) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        No active schedule slots. Add times on the{" "}
        <a href="/schedule" className="text-slate-900 underline">
          Schedule
        </a>{" "}
        page.
      </div>
    );
  }

  const targetMs = new Date(nextRun.nextRunAt).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  const countdown = formatCountdown(remainingSeconds);

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      {nextRun.inWindow && nextRun.activeSlotTimeLocal ? (
        <p className="font-medium">
          Measuring now — {nextRun.activePairLabel} at {nextRun.activeSlotTimeLocal}
        </p>
      ) : (
        <p className="font-medium">Next scheduled run</p>
      )}
      <p className="mt-1">{formatNextRunLabel(nextRun)}</p>
      <p className="mt-2 font-mono text-base">
        {remainingSeconds === 0 ? "Due now" : `Starts in ${countdown}`}
      </p>
      <p className="mt-1 text-xs text-sky-800/80">
        With the built-in scheduler enabled, the server checks automatically every few minutes
        during matching slot windows.
      </p>
    </div>
  );
}
