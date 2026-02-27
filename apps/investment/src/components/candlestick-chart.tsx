"use client";

import type { Ohlcv } from "@repo/common/types/investment";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

interface CandlestickChartProps {
  data: Ohlcv[];
}

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
  // For bar rendering: [low, high] range and [open, close] body
  range: [number, number];
  body: [number, number];
  bodyLow: number;
  bodyHeight: number;
}

const CustomCandlestickBar = (props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleData;
  value?: number[];
}) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || !width) return null;

  const { isUp } = payload;
  const color = isUp ? "#10b981" : "#f43f5e";
  const halfWidth = width / 2;
  const wickX = x + halfWidth;

  return (
    <g>
      {/* Wick line */}
      <line
        x1={wickX}
        y1={y}
        x2={wickX}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body rectangle */}
      <rect
        x={x + width * 0.15}
        y={y + height * 0.2}
        width={width * 0.7}
        height={Math.max(height * 0.6, 2)}
        fill={color}
        stroke={color}
      />
    </g>
  );
};

export function CandlestickChart({ data }: CandlestickChartProps) {
  const candleData: CandleData[] = useMemo(() => {
    return data.map((d) => {
      const isUp = d.close >= d.open;
      const bodyLow = Math.min(d.open, d.close);
      const bodyHigh = Math.max(d.open, d.close);
      return {
        timestamp: d.timestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        isUp,
        range: [d.low, d.high] as [number, number],
        body: [bodyLow, bodyHigh] as [number, number],
        bodyLow,
        bodyHeight: bodyHigh - bodyLow,
      };
    });
  }, [data]);

  if (candleData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No price data available
      </div>
    );
  }

  const prices = data.flatMap((d) => [d.high, d.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.05;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={candleData}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tickFormatter={formatPrice}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={70}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload as CandleData;
            return (
              <div className="rounded-lg border bg-popover p-2 shadow-md text-xs space-y-0.5">
                <p className="font-medium">{formatDate(d.timestamp)}</p>
                <p>
                  O: <span className="font-mono">{formatPrice(d.open)}</span>
                </p>
                <p>
                  H:{" "}
                  <span className="font-mono text-emerald-500">
                    {formatPrice(d.high)}
                  </span>
                </p>
                <p>
                  L:{" "}
                  <span className="font-mono text-rose-500">
                    {formatPrice(d.low)}
                  </span>
                </p>
                <p>
                  C: <span className="font-mono">{formatPrice(d.close)}</span>
                </p>
                {d.volume > 0 && (
                  <p className="text-muted-foreground">
                    Vol: {d.volume.toLocaleString()}
                  </p>
                )}
              </div>
            );
          }}
        />
        <Bar dataKey="high" shape={<CustomCandlestickBar />}>
          {candleData.map((entry) => (
            <Cell
              key={entry.timestamp}
              fill={entry.isUp ? "#10b981" : "#f43f5e"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
