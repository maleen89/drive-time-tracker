"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartPoint {
  label: string;
  minutes: number;
}

interface MeasurementsChartProps {
  data: ChartPoint[];
  seriesKey: string;
  color: string;
}

export function MeasurementsChart({ data, seriesKey, color }: MeasurementsChartProps) {
  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        No measurements yet for this pair.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis unit=" min" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number) => [`${value} min`, "Drive time"]} />
          <Legend />
          <Line
            type="monotone"
            dataKey="minutes"
            name={seriesKey}
            stroke={color}
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
