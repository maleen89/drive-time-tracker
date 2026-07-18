"use client";

import { useRouter } from "next/navigation";
import {
  measurementReturnLabel,
  type MeasurementReturnPath,
} from "@/lib/measurement-navigation";

export function MeasurementBackLink({ returnTo }: { returnTo: MeasurementReturnPath }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(returnTo);
      }}
      className="text-sm font-medium text-blue-600 hover:text-blue-700"
      aria-label={measurementReturnLabel(returnTo)}
    >
      ← Back
    </button>
  );
}
