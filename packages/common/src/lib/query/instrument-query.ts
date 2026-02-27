"use client";

import { investmentApi } from "@repo/common/lib/http";
import type {
  Instrument,
  InstrumentResponse,
  InstrumentsApiResponse,
  Ohlcv,
  OhlcvResponse,
  PaginatedInstrumentsResult,
} from "@repo/common/types/investment";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { buildSearchParams } from "../utils/url";

// ─── Mappers ─────────────────────────────────────────────────────────────────

const mapInstrument = (r: InstrumentResponse): Instrument => ({
  id: r.id,
  ticker: r.ticker,
  name: r.name,
  assetClass: r.asset_class as Instrument["assetClass"],
  exchange: r.exchange ?? null,
  currency: r.currency,
  metadata: r.metadata ?? null,
});

const mapOhlcv = (r: OhlcvResponse): Ohlcv => ({
  instrumentId: r.instrument_id,
  timestamp: r.timestamp,
  timeframe: r.timeframe,
  open: r.open,
  high: r.high,
  low: r.low,
  close: r.close,
  volume: r.volume,
});

// ─── Fetch functions ──────────────────────────────────────────────────────────

const fetchInstruments = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  assetClass?: string;
}): Promise<PaginatedInstrumentsResult> => {
  const qs = buildSearchParams({
    page: params?.page,
    limit: params?.limit,
    search: params?.search,
    assetClass: params?.assetClass,
  });
  const query = qs.toString();
  const url = query ? `/instruments?${query}` : "/instruments";

  const data = await investmentApi.get<InstrumentsApiResponse>(url, {
    unwrapData: false,
  });

  return {
    instruments: data.data ? data.data.map(mapInstrument) : [],
    pagination: data.meta?.pagination,
  };
};

const fetchOhlcv = async (params: {
  instrumentId: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<Ohlcv[]> => {
  const qs = buildSearchParams({
    timeframe: params.timeframe,
    startDate: params.startDate,
    endDate: params.endDate,
    limit: params.limit,
  });
  const data = await investmentApi.get<OhlcvResponse[]>(
    `/ohlcv/${params.instrumentId}?${qs.toString()}`,
  );
  return data.map(mapOhlcv);
};

const registerInstrument = async (
  payload: Omit<Instrument, "id">,
): Promise<Instrument> => {
  const data = await investmentApi.post<InstrumentResponse>("/instruments", {
    ticker: payload.ticker,
    name: payload.name,
    assetClass: payload.assetClass,
    exchange: payload.exchange ?? null,
    currency: payload.currency,
    metadata: payload.metadata ?? null,
  });
  return mapInstrument(data);
};

const syncOhlcv = async (payload: {
  instrumentId: string;
  timeframe: string;
  startDate: string;
  endDate: string;
}): Promise<{ synced: number }> => {
  return investmentApi.post<{ synced: number }>("/ohlcv/sync", payload);
};

// ─── Query / Mutation options ─────────────────────────────────────────────────

export const instrumentsQueryOptions = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  assetClass?: string;
}) =>
  queryOptions({
    queryKey: ["instruments", params],
    queryFn: () => fetchInstruments(params),
  });

export const instrumentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["instruments", id],
    queryFn: () =>
      investmentApi
        .get<InstrumentResponse>(`/instruments/${id}`)
        .then(mapInstrument),
    enabled: !!id,
  });

export const ohlcvQueryOptions = (params: {
  instrumentId: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) =>
  queryOptions({
    queryKey: ["ohlcv", params],
    queryFn: () => fetchOhlcv(params),
    enabled: !!params.instrumentId,
  });

export const registerInstrumentMutationOptions = () =>
  mutationOptions({
    mutationFn: registerInstrument,
  });

export const syncOhlcvMutationOptions = () =>
  mutationOptions({
    mutationFn: syncOhlcv,
  });
