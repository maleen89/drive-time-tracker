import { NextRequest, NextResponse } from "next/server";
import { CommutePeriod } from "@/lib/commute";
import { runScheduledMeasurements } from "@/lib/cron-runner";
import { getSchedulerToleranceMinutes } from "@/lib/time";

function parsePeriod(value: string | null): CommutePeriod | null {
  return value === "morning" || value === "afternoon" ? value : null;
}

export async function POST(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "period must be morning or afternoon" },
      { status: 400 },
    );
  }

  try {
    const result = await runScheduledMeasurements(
      new Date(),
      getSchedulerToleranceMinutes(),
      true,
      period,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Run now failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error while running measurements",
      },
      { status: 500 },
    );
  }
}
