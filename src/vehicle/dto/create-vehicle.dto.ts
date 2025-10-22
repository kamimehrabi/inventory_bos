import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsPositive,
  Length,
} from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @Length(17, 17)
  vin: string;

  @IsNumber()
  @Min(1900)
  year: number;

  @IsString()
  @IsNotEmpty()
  make: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsNumber()
  @IsPositive()
  price: number;
}
