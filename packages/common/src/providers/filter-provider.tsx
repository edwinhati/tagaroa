"use client";

import { createFilterStore } from "@repo/common/stores/filter-store";
import type { FilterState } from "@repo/common/types";
import { createContext, type ReactNode, useRef } from "react";

export type FilterStoreApi = ReturnType<typeof createFilterStore>;

export const FilterStoreContext = createContext<FilterStoreApi | undefined>(
  undefined,
);

export interface FilterProviderProps {
  children: ReactNode;
  initialState?: Partial<FilterState>;
}

export const FilterProvider = ({
  children,
  initialState,
}: FilterProviderProps) => {
  const storeRef = useRef<FilterStoreApi | undefined>(undefined);
  storeRef.current ??= createFilterStore(initialState);
  return (
    <FilterStoreContext.Provider value={storeRef.current}>
      {children}
    </FilterStoreContext.Provider>
  );
};
