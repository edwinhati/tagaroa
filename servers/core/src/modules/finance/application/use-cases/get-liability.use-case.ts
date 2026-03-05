import { Inject, Injectable } from "@nestjs/common";
import type { Liability } from "../../domain/entities/liability.entity";
import {
  LiabilityAccessDeniedException,
  LiabilityNotFoundException,
} from "../../domain/exceptions/liability.exceptions";
import type { ILiabilityRepository } from "../../domain/repositories/liability.repository.interface";
import { LIABILITY_REPOSITORY } from "../../domain/repositories/liability.repository.interface";

@Injectable()
export class GetLiabilityUseCase {
  @Inject(LIABILITY_REPOSITORY)
  private readonly liabilityRepository!: ILiabilityRepository;

  async execute(id: string, userId: string): Promise<Liability> {
    const liability = await this.liabilityRepository.findById(id);

    if (!liability) {
      throw new LiabilityNotFoundException(id);
    }

    if (liability.userId !== userId) {
      throw new LiabilityAccessDeniedException();
    }

    return liability;
  }
}
