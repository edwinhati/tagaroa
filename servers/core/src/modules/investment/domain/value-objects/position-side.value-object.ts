export const PositionSide = {
  LONG: "LONG",
  SHORT: "SHORT",
} as const;

export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide];
