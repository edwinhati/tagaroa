"use client";

import { createStore } from "zustand/vanilla";

export type BudgetPeriodState = {
  month: number;
  year: number;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
};

export const getDefaultPeriod = (): { month: number; year: number } => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDate = today.getDate();
  const month =
    currentDate > 25
      ? currentMonth === 12
        ? 1
        : currentMonth + 1
      : currentMonth;
  const year = today.getFullYear();
  return { month, year };
};

export const createBudgetStore = (initial?: Partial<BudgetPeriodState>) => {
  const defaults = getDefaultPeriod();
  const startMonth = initial?.month ?? defaults.month;
  const startYear = initial?.year ?? defaults.year;

  return createStore<BudgetPeriodState>()((set) => ({
    month: startMonth,
    year: startYear,
    setMonth: (month) => set(() => ({ month })),
    setYear: (year) => set(() => ({ year })),
  }));
};
