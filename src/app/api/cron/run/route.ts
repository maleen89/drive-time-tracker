import { NextRequest, NextResponse } from "next/server";
import { runScheduledMeasurements } from "@/lib/cron-runner";
import { getSchedulerToleranceMinutes } from "@/lib/time";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (!secret || (bearer !== secret && querySecret !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await runScheduledMeasurements(
      new Date(),
      getSchedulerToleranceMinutes(),
      force,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron run failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Server error while running measurements",
      },
      { status: 500 },
    );
  }
}
