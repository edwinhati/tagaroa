export const LiabilityType = {
  LOAN: "LOAN",
  MORTGAGE: "MORTGAGE",
  CREDIT_CARD: "CREDIT_CARD",
  AUTO_LOAN: "AUTO_LOAN",
  STUDENT_LOAN: "STUDENT_LOAN",
  MEDICAL_DEBT: "MEDICAL_DEBT",
  TAX_DEBT: "TAX_DEBT",
  OTHER: "OTHER",
} as const;

export type LiabilityType = (typeof LiabilityType)[keyof typeof LiabilityType];

const validTypes = new Set<string>(Object.values(LiabilityType));

export function isValidLiabilityType(value: string): value is LiabilityType {
  return validTypes.has(value);
}
