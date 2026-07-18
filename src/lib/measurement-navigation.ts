export type MeasurementReturnPath = "/" | "/measurements";

export function resolveMeasurementReturnTo(value: string | undefined): MeasurementReturnPath {
  if (value === "/" || value === "/measurements") {
    return value;
  }
  return "/measurements";
}

export function measurementReturnLabel(path: MeasurementReturnPath): string {
  switch (path) {
    case "/":
      return "Back to dashboard";
    case "/measurements":
      return "Back to history";
  }
}

export function measurementDetailHref(
  id: string,
  returnTo?: MeasurementReturnPath,
): string {
  const base = `/measurements/${id}`;
  if (!returnTo) {
    return base;
  }
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}
