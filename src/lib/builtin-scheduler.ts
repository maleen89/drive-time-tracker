import { runScheduledMeasurements } from "@/lib/cron-runner";
import {
  addDaysInTimeZone,
  DEFAULT_TIMEZONE,
  getSchedulerToleranceMinutes,
  getZonedParts,
  zonedDateTimeToUtc,
} from "@/lib/time";

const globalForScheduler = globalThis as unknown as {
  builtinSchedulerTimeout?: ReturnType<typeof setTimeout>;
  builtinSchedulerInterval?: ReturnType<typeof setInterval>;
};

function intervalMinutes(): number {
  const parsed = Number(process.env.SCHEDULER_INTERVAL_MINUTES ?? 5);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function schedulerTimeZone(): string {
  return process.env.DEFAULT_TIMEZONE ?? DEFAULT_TIMEZONE;
}

function msUntilNextAlignedCheck(now: Date, intervalMinutesValue: number, timeZone: string): number {
  const parts = getZonedParts(now, timeZone);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  const remainder = minuteOfDay % intervalMinutesValue;
  const minutesToAdd =
    remainder === 0 ? intervalMinutesValue : intervalMinutesValue - remainder;

  let targetMinuteOfDay = minuteOfDay + minutesToAdd;
  let year = parts.year;
  let month = parts.month;
  let day = parts.day;

  if (targetMinuteOfDay >= 24 * 60) {
    const nextDay = addDaysInTimeZone(now, 1, timeZone);
    year = nextDay.year;
    month = nextDay.month;
    day = nextDay.day;
    targetMinuteOfDay -= 24 * 60;
  }

  const targetHour = Math.floor(targetMinuteOfDay / 60);
  const targetMinute = targetMinuteOfDay % 60;
  const nextCheck = zonedDateTimeToUtc(year, month, day, targetHour, targetMinute, timeZone);

  return Math.max(250, nextCheck.getTime() - now.getTime());
}

function stopBuiltinScheduler() {
  if (globalForScheduler.builtinSchedulerTimeout) {
    clearTimeout(globalForScheduler.builtinSchedulerTimeout);
    globalForScheduler.builtinSchedulerTimeout = undefined;
  }
  if (globalForScheduler.builtinSchedulerInterval) {
    clearInterval(globalForScheduler.builtinSchedulerInterval);
    globalForScheduler.builtinSchedulerInterval = undefined;
  }
}

async function tick() {
  const toleranceMinutes = getSchedulerToleranceMinutes();
  const result = await runScheduledMeasurements(new Date(), toleranceMinutes, false);
  if (result.created > 0 || result.errors > 0) {
    console.log("[scheduler]", new Date().toISOString(), result);
  }
}

export function startBuiltinScheduler() {
  if (process.env.ENABLE_BUILTIN_SCHEDULER !== "true") {
    return;
  }

  stopBuiltinScheduler();

  const minutes = intervalMinutes();
  const intervalMs = minutes * 60 * 1000;
  const timeZone = schedulerTimeZone();

  console.log(
    `[scheduler] Built-in scheduler enabled — checking every ${minutes} minute(s), aligned to ${timeZone} clock`,
  );

  void tick().catch((error) => console.error("[scheduler]", error));

  const waitMs = msUntilNextAlignedCheck(new Date(), minutes, timeZone);
  globalForScheduler.builtinSchedulerTimeout = setTimeout(() => {
    void tick().catch((error) => console.error("[scheduler]", error));
    globalForScheduler.builtinSchedulerInterval = setInterval(() => {
      void tick().catch((error) => console.error("[scheduler]", error));
    }, intervalMs);
  }, waitMs);
}

export function isBuiltinSchedulerEnabled(): boolean {
  return process.env.ENABLE_BUILTIN_SCHEDULER === "true";
}
