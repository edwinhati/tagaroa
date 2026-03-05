import { Inject, Injectable } from "@nestjs/common";
import type { PaginationParams } from "../../../../shared/types/pagination";
import type { Liability } from "../../domain/entities/liability.entity";
import type {
  ILiabilityRepository,
  LiabilityFilterParams,
} from "../../domain/repositories/liability.repository.interface";
import { LIABILITY_REPOSITORY } from "../../domain/repositories/liability.repository.interface";

@Injectable()
export class GetLiabilitiesUseCase {
  @Inject(LIABILITY_REPOSITORY)
  private readonly liabilityRepository!: ILiabilityRepository;

  async execute(
    userId: string,
    pagination: PaginationParams,
    filters?: LiabilityFilterParams,
  ): Promise<{
    items: Liability[];
    total: number;
    aggregations: {
      type: Awaited<ReturnType<ILiabilityRepository["aggregateByType"]>>;
      currency: Awaited<
        ReturnType<ILiabilityRepository["aggregateByCurrency"]>
      >;
    };
  }> {
    const offset = (pagination.page - 1) * pagination.limit;
    const [result, typeAggregations, currencyAggregations] = await Promise.all([
      this.liabilityRepository.findByUserIdPaginated(
        userId,
        offset,
        pagination.limit,
        filters,
      ),
      this.liabilityRepository.aggregateByType(userId, filters),
      this.liabilityRepository.aggregateByCurrency(userId, filters),
    ]);

    return {
      items: result.items,
      total: result.total,
      aggregations: {
        type: typeAggregations,
        currency: currencyAggregations,
      },
    };
  }
}
