import { z } from "zod";

export const PositionSide = {
  LONG: "LONG",
  SHORT: "SHORT",
} as const;

export type PositionSide = (typeof PositionSide)[keyof typeof PositionSide];
export const PositionSideSchema = z.enum(["LONG", "SHORT"]);
