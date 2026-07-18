"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationData } from "@/components/setup/types";

export function LocationsSection({ locations }: { locations: LocationData[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setLoading(true);
    setError(null);
    const form = new FormData(formEl);
    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.get("label"),
          address: form.get("address"),
          isWork: form.get("isWork") === "on",
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Failed to add location");
        return;
      }
      formEl.reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function removeLocation(id: string) {
    if (!confirm("Delete this location?")) return;
    const response = await fetch(`/api/locations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error ?? "Failed to delete location");
      return;
    }
    router.refresh();
  }

  async function toggleWork(id: string) {
    await fetch(`/api/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isWork: true }),
    });
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Locations</h2>
        <p className="text-sm text-slate-600">
          Saved places used to build commute pairs. Mark exactly one as work.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Address</th>
              <th className="px-3 py-2 font-medium">Work</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => (
              <tr key={location.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{location.label}</td>
                <td className="px-3 py-2 text-slate-600">{location.address}</td>
                <td className="px-3 py-2">
                  <input
                    type="radio"
                    name="work-location"
                    checked={location.isWork}
                    onChange={() => toggleWork(location.id)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLocation(location.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={addLocation}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2"
      >
        <input
          name="label"
          required
          placeholder="Label (e.g. Fremont)"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="address"
          required
          placeholder="Full address"
          className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input name="isWork" type="checkbox" />
          This is the work location
        </label>
        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white md:col-span-2 md:w-fit"
        >
          Add location
        </button>
      </form>
    </section>
  );
}
