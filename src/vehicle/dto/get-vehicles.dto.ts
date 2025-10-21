// get-vehicles.dto.ts
import { IsOptional, IsInt, Min, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class GetVehiclesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  // Example format: 'price:ASC' or 'year:DESC'
  sort?: string;

  @IsOptional()
  @IsString()
  // Simple search/filter string (e.g., search by model)
  filter?: string;

  @IsOptional()
  @Type(() => Boolean)
  // Converts string 'true'/'false' from query to boolean
  @IsBoolean()
  includeDeleted?: boolean;
}
