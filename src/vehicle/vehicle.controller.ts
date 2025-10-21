// vehicle.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards, // <-- New Import for Query
} from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { GetVehiclesDto } from './dto/get-vehicles.dto'; // <-- New DTO for query params
import { Vehicle } from './vehicle.model';
import { VehicleService } from './vehicle.service';
import { DealershipContext } from 'src/auth/decorators/dealership-context.decorator';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/user/user.model';

@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('vehicle')
export class VehicleController {
  constructor(private readonly vehiclesService: VehicleService) {}

  @Post()
  create(
    @DealershipContext() dealershipId: string,
    @Body() createVehicleDto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.create(dealershipId, createVehicleDto);
  }

  @Get()
  findAll(
    @DealershipContext() dealershipId: string,
    @Query() query: GetVehiclesDto,
  ): Promise<Vehicle[] | null> {
    return this.vehiclesService.findAll(dealershipId, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
    @Query('includeDeleted') includeDeletedQuery?: string,
  ): Promise<Vehicle> {
    const includeDeleted = includeDeletedQuery === 'true';
    return this.vehiclesService.findOne(id, dealershipId, includeDeleted);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @DealershipContext() dealershipId: string,
  ): Promise<Vehicle> {
    return this.vehiclesService.update(id, updateVehicleDto, dealershipId);
  }

  // Epic 4, 18: Soft Delete (deletedAt) and authorization
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
  ): Promise<void> {
    // Authorization check and soft delete are handled inside the service
    return this.vehiclesService.remove(id, dealershipId);
  }
}
