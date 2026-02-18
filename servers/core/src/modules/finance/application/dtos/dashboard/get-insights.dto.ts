import { IsDateString } from "class-validator";

export class GetInsightsDto {
  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;
}
