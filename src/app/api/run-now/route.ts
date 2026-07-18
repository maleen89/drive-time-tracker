import { NextRequest, NextResponse } from "next/server";
import { CommutePeriod } from "@/lib/commute";
import { isBuiltinSchedulerEnabled } from "@/lib/builtin-scheduler";
import { runScheduledMeasurements } from "@/lib/cron-runner";

function parsePeriod(value: string | null): CommutePeriod | null {
  return value === "morning" || value === "afternoon" ? value : null;
}

export async function POST(request: NextRequest) {
  if (!isBuiltinSchedulerEnabled()) {
    return NextResponse.json(
      {
        error:
          "Run now is only available in local PC mode (ENABLE_BUILTIN_SCHEDULER=true).",
      },
      { status: 403 },
    );
  }

  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  if (!period) {
    return NextResponse.json(
      { error: "period must be morning or afternoon" },
      { status: 400 },
    );
  }

  try {
    const result = await runScheduledMeasurements(new Date(), 10, true, period);
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
