export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBuiltinScheduler } = await import("@/lib/builtin-scheduler");
    startBuiltinScheduler();
  }
}
