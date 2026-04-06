"use client";

import { createBudgetStore } from "@repo/common/stores/budget-store";
import { createContext, type ReactNode, useRef } from "react";

type BudgetStoreApi = ReturnType<typeof createBudgetStore>;

export const BudgetStoreContext = createContext<BudgetStoreApi | undefined>(
  undefined,
);

interface BudgetProviderProps {
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
