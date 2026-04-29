"use client";

import { instrumentsQueryOptions } from "@repo/common/lib/query/instrument-query";
import {
  portfoliosQueryOptions,
  positionsWithPnlQueryOptions,
} from "@repo/common/lib/query/portfolio-query";
import type { PositionWithPnl } from "@repo/common/types/investment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
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
  IconDots,
  IconEye,
  IconListDetails,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PositionDetailSheet } from "./position-detail-sheet";

type InstrumentMap = Map<string, { ticker: string; assetClass: string }>;

interface PositionRowProps {
  readonly position: PositionWithPnl;
  readonly instrumentsById: InstrumentMap;
  readonly onRowClick: () => void;
  readonly onView: () => void;
  readonly onClosePosition: () => void;
}

function PositionRow({
  position,
  instrumentsById,
  onRowClick,
  onView,
  onClosePosition,
}: PositionRowProps) {
  const isLong = position.side === "LONG";
  const instrument = instrumentsById.get(position.instrumentId);
  const isProfitable = position.unrealizedPnl >= 0;

  return (
    <TableRow
      className="transition-colors hover:bg-muted/40 cursor-pointer"
      onClick={onRowClick}
    >
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
      <TableCell
        className={cn(
          "text-right font-mono tabular-nums",
          isProfitable ? "text-emerald-600" : "text-red-600",
        )}
      >
        {position.unrealizedPnl >= 0 ? "+" : ""}
        {position.unrealizedPnl.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent hover:border-border hover:bg-muted"
          >
            <IconDots className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <IconEye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onClosePosition}
              className="text-red-600 focus:text-red-600"
            >
              <IconX className="mr-2 h-4 w-4" />
              Close Position
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

interface PortfolioSectionProps {
  readonly portfolioId: string;
  readonly portfolioName: string;
  readonly instrumentsById: InstrumentMap;
  readonly onViewPosition: (position: PositionWithPnl) => void;
  readonly onClosePosition: (position: PositionWithPnl) => void;
}

function PortfolioSection({
  portfolioId,
  portfolioName,
  instrumentsById,
  onViewPosition,
  onClosePosition,
}: PortfolioSectionProps) {
  const { data: positions = [], isLoading } = useQuery(
    positionsWithPnlQueryOptions(portfolioId),
  );

  const content = (() => {
    if (isLoading) {
      return <Skeleton className="h-32 w-full rounded-xl" />;
    }

    if (positions.length === 0) {
      return (
        <div className="rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
          No open positions
        </div>
      );
    }

    return (
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
                P&L
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos) => (
              <PositionRow
                key={pos.id}
                position={pos}
                instrumentsById={instrumentsById}
                onRowClick={() => onViewPosition(pos)}
                onView={() => onViewPosition(pos)}
                onClosePosition={() => onClosePosition(pos)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  })();

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

      {content}
    </section>
  );
}

export function PositionsTable() {
  const [viewingPosition, setViewingPosition] =
    useState<PositionWithPnl | null>(null);
  const [showViewSheet, setShowViewSheet] = useState(false);

  const { data, isLoading: portfoliosLoading } = useQuery(
    portfoliosQueryOptions({ page: 1, limit: 100 }),
  );
  const portfolios = data?.portfolios ?? [];

  const { data: instrumentsData } = useQuery(
    instrumentsQueryOptions({ limit: 200 }),
  );
  const instrumentsById: InstrumentMap = new Map(
    (instrumentsData?.instruments ?? []).map((i) => [
      i.id ?? "",
      { ticker: i.ticker, assetClass: i.assetClass },
    ]),
  );

  const handleViewPosition = (position: PositionWithPnl) => {
    setViewingPosition(position);
    setShowViewSheet(true);
  };

  const handleClosePosition = (_position: PositionWithPnl) => {};

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
    <>
      <div className="flex flex-col gap-8 p-6 max-w-7xl">
        {portfolios.map((portfolio) => (
          <PortfolioSection
            key={portfolio.id}
            portfolioId={portfolio.id ?? ""}
            portfolioName={portfolio.name}
            instrumentsById={instrumentsById}
            onViewPosition={handleViewPosition}
            onClosePosition={handleClosePosition}
          />
        ))}
      </div>

      <PositionDetailSheet
        position={viewingPosition}
        open={showViewSheet}
        onOpenChange={setShowViewSheet}
        onClosePosition={() => {
          if (viewingPosition) {
            handleClosePosition(viewingPosition);
          }
        }}
      />
    </>
  );
}
