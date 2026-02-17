import { Expose, Transform } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Currency } from "../../domain/value-objects/currency";
import { TransactionType } from "../../domain/value-objects/transaction-type";

export class CreateTransactionDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  files?: string[];

  @IsUUID()
  @Expose({ name: "account_id" })
  accountId!: string;

  @IsUUID()
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === "" ? undefined : value,
  )
  @Expose({ name: "budget_item_id" })
  budgetItemId?: string;
}
