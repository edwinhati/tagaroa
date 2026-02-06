"use client";

import { FilterStoreContext } from "@repo/common/providers/filter-provider";
import type { FilterState } from "@repo/common/types";
import { useContext } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

export const useFilters = <T>(selector: (s: FilterState) => T): T => {
  const ctx = useContext(FilterStoreContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return useStoreWithEqualityFn(ctx, selector, shallow);
};
