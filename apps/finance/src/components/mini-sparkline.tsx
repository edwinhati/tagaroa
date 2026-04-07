"use client";

import { ChartContainer } from "@repo/ui/components/chart";
import { Line, LineChart } from "recharts";

type MiniSparklineProps = Readonly<{
  data: ReadonlyArray<{ readonly value: number }>;
  className?: string;
  color?: string;
}>;

export function MiniSparkline({
  data,
  className = "h-12 w-full",
  color = "currentColor",
}: MiniSparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ChartContainer
      config={{
        value: {
          label: "Value",
          color,
        },
      }}
      className={className}
    >
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
