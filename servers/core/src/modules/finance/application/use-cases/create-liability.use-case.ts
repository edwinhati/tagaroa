import { Inject, Injectable } from "@nestjs/common";
import { Liability } from "../../domain/entities/liability.entity";
import type { ILiabilityRepository } from "../../domain/repositories/liability.repository.interface";
import { LIABILITY_REPOSITORY } from "../../domain/repositories/liability.repository.interface";
import type { CreateLiabilityDto } from "../dtos/create-liability.dto";

@Injectable()
export class CreateLiabilityUseCase {
  constructor(
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
  ) {}

  async execute(dto: CreateLiabilityDto, userId: string): Promise<Liability> {
    const now = new Date();
    const liability = new Liability(
      crypto.randomUUID(),
      userId,
      dto.name,
      dto.type,
      dto.amount ?? 0,
      dto.currency,
      dto.paidAt ? new Date(dto.paidAt) : null,
      dto.notes ?? null,
      null,
      now,
      now,
      1,
    );

    return this.liabilityRepository.create(liability);
  }
}
