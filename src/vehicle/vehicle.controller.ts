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
  UseGuards,
  UseInterceptors,
  UploadedFile, // <-- New Import for Query
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
import { FileInterceptor } from '@nestjs/platform-express';

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
  ): Promise<{ rows: Vehicle[]; count: number }> {
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
  ): Promise<void> {
    return this.vehiclesService.remove(id, dealershipId);
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @DealershipContext() dealershipId: string,
    @UploadedFile() file: Express.Multer.File, // File is now a buffer
  ): Promise<Vehicle> {
    return this.vehiclesService.uploadImage(id, dealershipId, file);
  }
}
