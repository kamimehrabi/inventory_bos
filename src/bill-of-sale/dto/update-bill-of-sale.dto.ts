import { IsNumber, IsOptional, IsEnum, IsPositive } from 'class-validator';
import { BosStatus } from '../bill-of-sale.model';

export class UpdateBillOfSaleDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  finalPrice?: number;

  @IsEnum(BosStatus)
  @IsOptional()
  bosStatus?: BosStatus;
}
