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

  const isNextMonth = currentDate > 25;
  const isDecember = currentMonth === 12;

  let month: number;
  let year: number;

  if (isNextMonth) {
    month = isDecember ? 1 : currentMonth + 1;
    year = isDecember ? today.getFullYear() + 1 : today.getFullYear();
  } else {
    month = currentMonth;
    year = today.getFullYear();
  }

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
