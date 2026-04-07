"use client";

import type { CorrelationMatrix } from "@repo/common/types/investment";
import { cn } from "@repo/ui/lib/utils";

function correlationColor(value: number): string {
  // -1 → deep rose, 0 → neutral, +1 → deep emerald
  if (value >= 0.8) return "bg-emerald-600 text-white";
  if (value >= 0.5) return "bg-emerald-500/70 text-white";
  if (value >= 0.2) return "bg-emerald-400/40 text-foreground";
  if (value >= -0.2) return "bg-muted text-foreground";
  if (value >= -0.5) return "bg-rose-400/40 text-foreground";
  if (value >= -0.8) return "bg-rose-500/70 text-white";
  return "bg-rose-600 text-white";
}

interface CorrelationHeatmapProps {
  readonly data: CorrelationMatrix;
}

export function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  const { tickers, matrix } = data;

  if (tickers.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No positions to correlate
      </div>
    );
  }

  if (tickers.length === 1) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        At least 2 positions needed for correlation
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="w-16 px-2 py-1" />
            {tickers.map((ticker) => (
              <th
                key={ticker}
                className="px-2 py-1 font-mono font-semibold text-center text-muted-foreground"
              >
                {ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowTicker, i) => (
            <tr key={rowTicker}>
              <td className="px-2 py-1 font-mono font-semibold text-right text-muted-foreground whitespace-nowrap">
                {rowTicker}
              </td>
              {tickers.map((colTicker, j) => {
                const val = matrix[i]?.[j] ?? 0;
                return (
                  <td key={`${rowTicker}-${colTicker}`} className="p-0.5">
                    <div
                      className={cn(
                        "flex h-10 w-16 items-center justify-center rounded font-mono tabular-nums font-medium",
                        correlationColor(val),
                      )}
                    >
                      {val.toFixed(2)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-rose-600" />
          <span>-1.0 strong neg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-muted border" />
          <span>0 neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-600" />
          <span>+1.0 strong pos</span>
        </div>
      </div>
    </div>
  );
}
