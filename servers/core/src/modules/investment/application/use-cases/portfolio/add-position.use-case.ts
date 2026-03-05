import { Inject, Injectable } from "@nestjs/common";
import {
  InstrumentNotFoundException,
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import { CashFlow } from "../../../domain/portfolio/entities/cash-flow.entity";
import { Position } from "../../../domain/portfolio/entities/position.entity";
import { Trade } from "../../../domain/portfolio/entities/trade.entity";
import {
  CASH_FLOW_REPOSITORY,
  type ICashFlowRepository,
} from "../../../domain/portfolio/repositories/cash-flow.repository.interface";
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
import { CashFlowType } from "../../../domain/value-objects/cash-flow-type.value-object";
import { TradeSide } from "../../../domain/value-objects/trade-side.value-object";
import type { AddPositionDto } from "../../dtos/portfolio/add-position.dto";

@Injectable()
export class AddPositionUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(INSTRUMENT_REPOSITORY)
  private readonly instrumentRepository!: IInstrumentRepository;
  @Inject(POSITION_REPOSITORY)
  private readonly positionRepository!: IPositionRepository;
  @Inject(TRADE_REPOSITORY)
  private readonly tradeRepository!: ITradeRepository;
  @Inject(CASH_FLOW_REPOSITORY)
  private readonly cashFlowRepository!: ICashFlowRepository;

  async execute(
    portfolioId: string,
    dto: AddPositionDto,
    userId: string,
  ): Promise<Position> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const instrument = await this.instrumentRepository.findById(
      dto.instrumentId,
    );
    if (!instrument) {
      throw new InstrumentNotFoundException(dto.instrumentId);
    }

    const now = new Date();
    const tradeTimestamp = dto.openedAt ? new Date(dto.openedAt) : now;

    // Check for existing open position for consolidation (weighted average cost)
    const existing = await this.positionRepository.findByPortfolioAndInstrument(
      portfolioId,
      dto.instrumentId,
    );

    let position: Position;

    if (dto.side === existing?.side) {
      // Consolidate: compute weighted average cost
      const totalQty = existing.quantity + dto.quantity;
      const newAvgCost =
        (existing.quantity * existing.averageCost +
          dto.quantity * dto.averageCost) /
        totalQty;

      const consolidated = new Position(
        existing.id,
        existing.portfolioId,
        existing.instrumentId,
        totalQty,
        newAvgCost,
        existing.side,
        existing.openedAt,
        null,
        existing.createdAt,
        now,
      );
      position = await this.positionRepository.update(consolidated);
    } else {
      // New position
      position = await this.positionRepository.create(
        new Position(
          crypto.randomUUID(),
          portfolioId,
          dto.instrumentId,
          dto.quantity,
          dto.averageCost,
          dto.side,
          tradeTimestamp,
          null,
          now,
          now,
        ),
      );
    }

    // Record BUY trade
    await this.tradeRepository.create(
      new Trade(
        crypto.randomUUID(),
        portfolioId,
        position.id,
        dto.instrumentId,
        TradeSide.BUY,
        dto.quantity,
        dto.averageCost,
        dto.fees ?? 0,
        null,
        tradeTimestamp,
        now,
      ),
    );

    // Record fee as a cash flow if applicable
    if (dto.fees && dto.fees > 0) {
      await this.cashFlowRepository.create(
        new CashFlow(
          crypto.randomUUID(),
          portfolioId,
          CashFlowType.FEE,
          dto.fees,
          `Trading fee for buying ${dto.quantity} ${instrument.ticker}`,
          tradeTimestamp,
          now,
        ),
      );
    }

    return position;
  }
}
