"use client";

import { BudgetStoreContext } from "@repo/common/providers/budget-provider";
import type { BudgetPeriodState } from "@repo/common/stores/budget-store";
import { useContext } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

export const useBudgetPeriod = <T>(
  selector: (s: BudgetPeriodState) => T,
): T => {
  const ctx = useContext(BudgetStoreContext);
  if (!ctx)
    throw new Error("useBudgetPeriod must be used within BudgetStoreProvider");
  return useStoreWithEqualityFn(ctx, selector, shallow);
};
