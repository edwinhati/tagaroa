import { Inject, Injectable } from "@nestjs/common";
import { Liability } from "../../domain/entities/liability.entity";
import {
  LiabilityAccessDeniedException,
  LiabilityNotFoundException,
} from "../../domain/exceptions/liability.exceptions";
import type { ILiabilityRepository } from "../../domain/repositories/liability.repository.interface";
import { LIABILITY_REPOSITORY } from "../../domain/repositories/liability.repository.interface";
import type { UpdateLiabilityDto } from "../dtos/update-liability.dto";

@Injectable()
export class UpdateLiabilityUseCase {
  @Inject(LIABILITY_REPOSITORY)
  private readonly liabilityRepository!: ILiabilityRepository;

  async execute(
    id: string,
    dto: UpdateLiabilityDto,
    userId: string,
  ): Promise<Liability> {
    const existing = await this.liabilityRepository.findById(id);

    if (!existing) {
      throw new LiabilityNotFoundException(id);
    }

    if (existing.userId !== userId) {
      throw new LiabilityAccessDeniedException();
    }

    const updated = new Liability(
      existing.id,
      existing.userId,
      dto.name ?? existing.name,
      dto.type ?? existing.type,
      dto.amount ?? existing.amount,
      dto.currency ?? existing.currency,
      dto.paidAt !== undefined
        ? dto.paidAt
          ? new Date(dto.paidAt)
          : null
        : existing.paidAt,
      dto.notes !== undefined ? dto.notes : existing.notes,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.liabilityRepository.update(updated);
  }
}
