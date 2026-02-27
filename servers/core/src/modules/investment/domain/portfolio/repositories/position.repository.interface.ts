import type { Position } from "../entities/position.entity";

export const POSITION_REPOSITORY = Symbol("POSITION_REPOSITORY");

export interface IPositionRepository {
  findById(id: string): Promise<Position | null>;
  findByPortfolioId(portfolioId: string): Promise<Position[]>;
  findOpenByPortfolioId(portfolioId: string): Promise<Position[]>;
  findByPortfolioAndInstrument(
    portfolioId: string,
    instrumentId: string,
  ): Promise<Position | null>;
  create(position: Position): Promise<Position>;
  update(position: Position): Promise<Position>;
}
