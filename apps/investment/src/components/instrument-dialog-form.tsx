"use client";

import {
  lookupInstrumentsQueryOptions,
  registerInstrumentMutationOptions,
} from "@repo/common/lib/query/instrument-query";
import type {
  Instrument,
  InstrumentLookupResult,
} from "@repo/common/types/investment";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  IconCheck,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Asset class color config (mirrors instrument-browser.tsx)
// ---------------------------------------------------------------------------

const CLASS_COLOR: Record<string, string> = {
  STOCK: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  CRYPTO:
    "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  FOREX:
    "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  ETF: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  COMMODITY:
    "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
};

function AssetClassBadge({ cls }: { cls: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold leading-none tracking-wide",
        CLASS_COLOR[cls] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {cls}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultRow({
  result,
  alreadyAdded,
  onAdd,
  isAdding,
}: {
  result: InstrumentLookupResult;
  alreadyAdded: boolean;
  onAdd: () => void;
  isAdding: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors">
      {/* Ticker + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-bold text-sm">{result.ticker}</span>
          <AssetClassBadge cls={result.assetClass} />
          <span className="text-[10px] text-muted-foreground/60 font-mono uppercase">
            {result.source}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {result.name}
          {result.exchange && (
            <span className="ml-1.5 text-muted-foreground/50">
              · {result.exchange}
            </span>
          )}
          <span className="ml-1.5 text-muted-foreground/50">
            · {result.currency}
          </span>
        </p>
      </div>

      {/* Add button */}
      <Button
        size="sm"
        variant={alreadyAdded ? "ghost" : "outline"}
        onClick={onAdd}
        disabled={alreadyAdded || isAdding}
        className="h-7 w-7 p-0 flex-shrink-0"
        title={alreadyAdded ? "Already in registry" : `Add ${result.ticker}`}
      >
        {isAdding ? (
          <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
        ) : alreadyAdded ? (
          <IconCheck className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <IconPlus className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstrumentDialogForm
// ---------------------------------------------------------------------------

interface InstrumentDialogFormProps {
  /** Tickers already in the registry — used to disable duplicate adds */
  existingTickers: Set<string>;
  /** Triggered after a successful registration so the parent can refresh */
  onAdded?: (instrument: Instrument) => void;
  children?: React.ReactElement;
}

export function InstrumentDialogForm({
  existingTickers,
  onAdded,
  children,
}: InstrumentDialogFormProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Debounce the search query by 350ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const { data: results = [], isFetching } = useQuery(
    lookupInstrumentsQueryOptions(debouncedQuery),
  );

  const { mutate: register } = useMutation({
    ...registerInstrumentMutationOptions(),
    onMutate: (payload) => setAddingTicker(payload.ticker),
    onSuccess: (instrument) => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      toast.success(`${instrument.ticker} added to registry`);
      onAdded?.(instrument);
      setAddingTicker(null);
    },
    onError: (err: Error, payload) => {
      toast.error(`Failed to add ${payload.ticker}: ${err.message}`);
      setAddingTicker(null);
    },
  });

  function handleAdd(result: InstrumentLookupResult) {
    register({
      ticker: result.ticker,
      name: result.name,
      assetClass: result.assetClass,
      exchange: result.exchange ?? null,
      currency: result.currency,
      metadata: null,
    });
  }

  const showSkeleton = isFetching && results.length === 0;
  const showEmpty =
    !isFetching && debouncedQuery.length > 0 && results.length === 0;
  const showHint = debouncedQuery.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          children ?? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <IconPlus className="h-3.5 w-3.5" />
              Add
            </Button>
          )
        }
      />

      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm font-semibold">
            Add Instrument
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="border-b px-3 py-2.5">
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            {isFetching && debouncedQuery.length > 0 && (
              <IconLoader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground animate-spin" />
            )}
            {!isFetching && query.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <IconX className="h-3 w-3" />
              </Button>
            )}
            <Input
              ref={inputRef}
              placeholder="Search ticker or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 border-0 pl-8 pr-8 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {showHint && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground px-6">
              <IconSearch className="h-6 w-6 opacity-30" />
              <p className="text-sm">
                Search across Yahoo Finance and CoinGecko
              </p>
            </div>
          )}

          {showSkeleton && (
            <div className="space-y-px p-2">
              {Array.from({ length: 5 }).map(() => (
                <Skeleton
                  key={crypto.randomUUID()}
                  className="h-12 w-full rounded-md"
                />
              ))}
            </div>
          )}

          {showEmpty && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground px-6">
              <p className="text-sm font-medium text-foreground">
                No results for "{debouncedQuery}"
              </p>
              <p className="text-xs">
                Try a different ticker symbol or company name
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-1.5">
              {results.map((result) => {
                const alreadyAdded = existingTickers.has(
                  result.ticker.toUpperCase(),
                );
                return (
                  <ResultRow
                    key={`${result.source}-${result.ticker}`}
                    result={result}
                    alreadyAdded={alreadyAdded}
                    onAdd={() => handleAdd(result)}
                    isAdding={addingTicker === result.ticker}
                  />
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
