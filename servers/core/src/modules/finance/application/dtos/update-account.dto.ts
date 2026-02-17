import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  balance?: number;

  @IsString()
  @IsOptional()
  notes?: string | null;
}
