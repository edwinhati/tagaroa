"use client";

import { createStore } from "zustand/vanilla";

import type { FilterState } from "../types";

export const createFilterStore = (initial?: Partial<FilterState>) => {
  return createStore<FilterState>()((set) => ({
    serverFilters: initial?.serverFilters ?? {},
    range: initial?.range ?? undefined,
    openPopovers: initial?.openPopovers ?? {},
    setServerFilters: (filters) => set(() => ({ serverFilters: filters })),
    setRange: (range) => set(() => ({ range })),
    setOpenPopovers: (popovers) => set(() => ({ openPopovers: popovers })),
  }));
};
