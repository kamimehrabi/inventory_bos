import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicle.dto';

const UpdateVehicleFields = PickType(CreateVehicleDto, ['price']);

export class UpdateVehicleDto extends PartialType(UpdateVehicleFields) {}
