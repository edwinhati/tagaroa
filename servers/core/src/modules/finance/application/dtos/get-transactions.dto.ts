import { Expose, Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { TransactionType } from "../../domain/value-objects/transaction-type";

export class GetTransactionsDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @Expose({ name: "order_by" })
  orderBy?: string;

  @IsEnum(TransactionType, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",");
    }
    return value;
  })
  type?: TransactionType[];

  @IsUUID(undefined, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",");
    }
    return value;
  })
  @Expose({ name: "account_id" })
  accountId?: string[];

  @IsUUID(undefined, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",");
    }
    return value;
  })
  @Expose({ name: "budget_item_id" })
  budgetItemId?: string[];

  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",");
    }
    return value;
  })
  currency?: string[];

  @IsDateString()
  @IsOptional()
  @Expose({ name: "start_date" })
  startDate?: string;

  @IsDateString()
  @IsOptional()
  @Expose({ name: "end_date" })
  endDate?: string;
}
