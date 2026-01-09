"use client";

import { createBudgetStore } from "@repo/common/stores/budget-store";
import React, { createContext, type ReactNode, useRef } from "react";

export type BudgetStoreApi = ReturnType<typeof createBudgetStore>;

export const BudgetStoreContext = createContext<BudgetStoreApi | undefined>(
  undefined,
);

export interface BudgetProviderProps {
  children: ReactNode;
  month?: number;
  year?: number;
}

export const BudgetProvider = ({
  children,
  month,
  year,
}: BudgetProviderProps) => {
  const storeRef = useRef<BudgetStoreApi | undefined>(undefined);
  storeRef.current ??= createBudgetStore({ month, year });
  return (
    <BudgetStoreContext.Provider value={storeRef.current}>
      {children}
    </BudgetStoreContext.Provider>
  );
};
