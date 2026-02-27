"use client";

import { instrumentsQueryOptions } from "@repo/common/lib/query/instrument-query";
import {
  portfoliosQueryOptions,
  positionsQueryOptions,
} from "@repo/common/lib/query/portfolio-query";
import type { Instrument, Position } from "@repo/common/types/investment";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconListDetails,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

type InstrumentMap = Map<string, { ticker: string; assetClass: string }>;

function PositionRow({
  position,
  instrumentsById,
}: {
  position: Position;
  instrumentsById: InstrumentMap;
}) {
  const isLong = position.side === "LONG";
  const instrument = instrumentsById.get(position.instrumentId);

  return (
    <TableRow className="transition-colors hover:bg-muted/40">
      <TableCell>
        {instrument ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-semibold">{instrument.ticker}</span>
            <span className="text-xs text-muted-foreground">
              {instrument.assetClass}
            </span>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {position.instrumentId.slice(0, 8)}…
          </span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            isLong
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          {isLong ? (
            <IconArrowUpRight className="h-3 w-3" />
          ) : (
            <IconArrowDownRight className="h-3 w-3" />
          )}
          {position.side}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {position.quantity}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {position.averageCost.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })}
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {new Date(position.openedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </TableCell>
    </TableRow>
  );
}

function PortfolioSection({
  portfolioId,
  portfolioName,
  instrumentsById,
}: {
  portfolioId: string;
  portfolioName: string;
  instrumentsById: InstrumentMap;
}) {
  const { data: positions = [], isLoading } = useQuery(
    positionsQueryOptions(portfolioId),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{portfolioName}</h3>
        {!isLoading && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {positions.length} open
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : positions.length === 0 ? (
        <div className="rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
          No open positions
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs uppercase tracking-wider">
                  Instrument
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">
                  Side
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">
                  Qty
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">
                  Avg Cost
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider">
                  Opened
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((pos) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  instrumentsById={instrumentsById}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

export function PositionsTable() {
  const { data, isLoading: portfoliosLoading } = useQuery(
    portfoliosQueryOptions({ page: 1, limit: 100 }),
  );
  const portfolios = data?.portfolios ?? [];

  // Fetch all instruments once at the top level — shared across all portfolio sections
  const { data: instrumentsData } = useQuery(
    instrumentsQueryOptions({ limit: 200 }),
  );
  const instrumentsById: InstrumentMap = new Map(
    (instrumentsData?.instruments ?? []).map((i) => [
      i.id ?? "",
      { ticker: i.ticker, assetClass: i.assetClass },
    ]),
  );

  if (portfoliosLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-7xl">
        <Skeleton className="h-6 w-40" />
        {["sk-1", "sk-2"].map((key) => (
          <Skeleton key={key} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="rounded-full bg-muted p-4">
          <IconListDetails className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">No portfolios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a portfolio first to track positions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl">
      {portfolios.map((portfolio) => (
        <PortfolioSection
          key={portfolio.id}
          portfolioId={portfolio.id ?? ""}
          portfolioName={portfolio.name}
          instrumentsById={instrumentsById}
        />
      ))}
    </div>
  );
}
