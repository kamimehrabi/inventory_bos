import {
  IsInt,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsPositive,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { BosStatus } from '../bill-of-sale.model';

export class CreateBillOfSaleDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  vehicleId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsNotEmpty()
  finalPrice: number;

  @IsString()
  @IsNotEmpty()
  buyerName: string;

  @IsString()
  @IsNotEmpty()
  buyerAddress: string;

  @IsEnum(BosStatus)
  @IsOptional()
  bosStatus?: BosStatus;
}
