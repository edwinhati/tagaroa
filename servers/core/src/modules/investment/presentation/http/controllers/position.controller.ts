import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AddPositionDto } from "../../../application/dtos/portfolio/add-position.dto";
import { ClosePositionDto } from "../../../application/dtos/portfolio/close-position.dto";
import { toPositionResponse } from "../../../application/dtos/portfolio/position-response.dto";
import { AddPositionUseCase } from "../../../application/use-cases/portfolio/add-position.use-case";
import { ClosePositionUseCase } from "../../../application/use-cases/portfolio/close-position.use-case";
import { GetPositionsUseCase } from "../../../application/use-cases/portfolio/get-positions.use-case";

@Controller("investment/portfolios/:portfolioId/positions")
export class PositionController {
  constructor(
    private readonly addPositionUseCase: AddPositionUseCase,
    private readonly getPositionsUseCase: GetPositionsUseCase,
    private readonly closePositionUseCase: ClosePositionUseCase,
  ) {}

  @Get()
  async list(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Query("openOnly") openOnly?: string,
  ) {
    const positions = await this.getPositionsUseCase.execute(
      portfolioId,
      session.user.id,
      openOnly !== "false",
    );
    return positions.map(toPositionResponse);
  }

  @Post()
  async add(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Body() dto: AddPositionDto,
  ) {
    const position = await this.addPositionUseCase.execute(
      portfolioId,
      dto,
      session.user.id,
    );
    return toPositionResponse(position);
  }

  @Delete(":positionId")
  async close(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Param("positionId", ParseUUIDPipe) positionId: string,
    @Session() session: UserSession,
    @Body() dto: ClosePositionDto,
  ) {
    const position = await this.closePositionUseCase.execute(
      portfolioId,
      positionId,
      session.user.id,
      dto,
    );
    return toPositionResponse(position);
  }
}
