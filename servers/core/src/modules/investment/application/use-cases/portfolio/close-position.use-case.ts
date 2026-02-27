import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
  PositionAlreadyClosedException,
  PositionNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import { Position } from "../../../domain/portfolio/entities/position.entity";
import { Trade } from "../../../domain/portfolio/entities/trade.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
} from "../../../domain/portfolio/repositories/position.repository.interface";
import {
  type ITradeRepository,
  TRADE_REPOSITORY,
} from "../../../domain/portfolio/repositories/trade.repository.interface";
import { TradeSide } from "../../../domain/value-objects/trade-side.value-object";
import type { ClosePositionDto } from "../../dtos/portfolio/close-position.dto";

@Injectable()
export class ClosePositionUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepository: IPositionRepository,
    @Inject(TRADE_REPOSITORY)
    private readonly tradeRepository: ITradeRepository,
  ) {}

  async execute(
    portfolioId: string,
    positionId: string,
    userId: string,
    dto: ClosePositionDto,
  ): Promise<Position> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const position = await this.positionRepository.findById(positionId);
    if (!position || position.portfolioId !== portfolioId) {
      throw new PositionNotFoundException(positionId);
    }
    if (!position.isOpen()) {
      throw new PositionAlreadyClosedException(positionId);
    }

    const now = new Date();
    const closeQty = dto.quantity ?? position.quantity;
    const isFullClose = closeQty >= position.quantity;

    // Realized P&L: (closePrice - avgCost) * qty for LONG; reversed for SHORT
    const fees = dto.fees ?? 0;
    const rawPnl =
      position.side === "LONG"
        ? (dto.price - position.averageCost) * closeQty
        : (position.averageCost - dto.price) * closeQty;
    const realizedPnl = rawPnl - fees;

    // Record SELL trade
    await this.tradeRepository.create(
      new Trade(
        crypto.randomUUID(),
        portfolioId,
        positionId,
        position.instrumentId,
        TradeSide.SELL,
        closeQty,
        dto.price,
        fees,
        realizedPnl,
        now,
        now,
      ),
    );

    let updatedPosition: Position;

    if (isFullClose) {
      updatedPosition = new Position(
        position.id,
        position.portfolioId,
        position.instrumentId,
        position.quantity,
        position.averageCost,
        position.side,
        position.openedAt,
        now,
        position.createdAt,
        now,
      );
    } else {
      // Partial close: reduce quantity
      const remainingQty = position.quantity - closeQty;
      updatedPosition = new Position(
        position.id,
        position.portfolioId,
        position.instrumentId,
        remainingQty,
        position.averageCost,
        position.side,
        position.openedAt,
        null,
        position.createdAt,
        now,
      );
    }

    return this.positionRepository.update(updatedPosition);
  }
}
