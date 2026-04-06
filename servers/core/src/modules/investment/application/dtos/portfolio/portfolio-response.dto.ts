import type { Portfolio } from "../../../domain/portfolio/entities/portfolio.entity";

type PortfolioResponseDto = {
  id: string;
  user_id: string;
  name: string;
  mode: string;
  initial_capital: number;
  currency: string;
  status: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export function toPortfolioResponse(
  portfolio: Portfolio,
): PortfolioResponseDto {
  return {
    id: portfolio.id,
    user_id: portfolio.userId,
    name: portfolio.name,
    mode: portfolio.mode,
    initial_capital: portfolio.initialCapital,
    currency: portfolio.currency,
    status: portfolio.status,
    deleted_at: portfolio.deletedAt,
    created_at: portfolio.createdAt,
    updated_at: portfolio.updatedAt,
    version: portfolio.version,
  };
}
