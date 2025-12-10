"use client";

import { useContext } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { BudgetPeriodState } from "@repo/common/stores/budget-store";
import { BudgetStoreContext } from "@repo/common/providers/budget-provider";

export const useBudgetPeriod = <T>(
  selector: (s: BudgetPeriodState) => T,
): T => {
  const ctx = useContext(BudgetStoreContext);
  if (!ctx)
    throw new Error("useBudgetPeriod must be used within BudgetStoreProvider");
  return useStoreWithEqualityFn(ctx, selector, shallow);
};
