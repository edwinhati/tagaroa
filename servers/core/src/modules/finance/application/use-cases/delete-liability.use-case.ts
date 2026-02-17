import { Inject, Injectable } from "@nestjs/common";
import {
  LiabilityAccessDeniedException,
  LiabilityNotFoundException,
} from "../../domain/exceptions/liability.exceptions";
import type { ILiabilityRepository } from "../../domain/repositories/liability.repository.interface";
import { LIABILITY_REPOSITORY } from "../../domain/repositories/liability.repository.interface";

@Injectable()
export class DeleteLiabilityUseCase {
  constructor(
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const liability = await this.liabilityRepository.findById(id);

    if (!liability) {
      throw new LiabilityNotFoundException(id);
    }

    if (liability.userId !== userId) {
      throw new LiabilityAccessDeniedException();
    }

    await this.liabilityRepository.delete(id);
  }
}
