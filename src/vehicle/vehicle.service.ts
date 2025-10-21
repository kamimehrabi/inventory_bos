import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Vehicle } from './vehicle.model';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { GetVehiclesDto } from './dto/get-vehicles.dto';

@Injectable()
export class VehicleService {
  constructor(
    @InjectModel(Vehicle)
    private readonly vehicleModel: typeof Vehicle,
    private readonly logger: WinstonLogger,
  ) {
    this.logger.setContext(VehicleService.name);
  }

  async create(
    dealershipId: string,
    createVehicleDto: CreateVehicleDto,
  ): Promise<Vehicle> {
    const { vin } = createVehicleDto;

    const existingVehicle = await this.vehicleModel.findOne({
      where: { dealershipId, vin },
      paranoid: false,
    });

    if (existingVehicle) {
      this.logger.warn(`This ${vin} number already exists in your inventory`);
      throw new ForbiddenException(
        'VIN number already exists in your inventory',
      );
    }

    this.logger.log(`Creating a new vehicle with VIN: ${createVehicleDto.vin}`);
    const vehicle = await this.vehicleModel.create({
      ...createVehicleDto,
      dealershipId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return vehicle;
  }

  async findAll(
    dealershipId: string,
    query: GetVehiclesDto,
  ): Promise<Vehicle[] | null> {
    const { includeDeleted = false } = query;
    this.logger.log(
      `Dealership ${dealershipId}: Fetching all vehicles (includeDeleted: ${includeDeleted})`,
    );

    const vehicles = await this.vehicleModel.findAll({
      where: { dealershipId },
      paranoid: !includeDeleted,
    });

    this.logger.log(
      `Dealership ${dealershipId}: Found ${vehicles.length} vehicles.`,
    );
    return vehicles;
  }

  async findOne(
    id: number,
    dealershipId: string,
    includeDeleted: boolean = false,
  ): Promise<Vehicle> {
    return this.findVehicleById(id, dealershipId, includeDeleted);
  }

  async update(
    id: number,
    updateVehicleDto: UpdateVehicleDto,
    dealershipId: string,
  ): Promise<Vehicle> {
    const vehicle = await this.findVehicleById(id, dealershipId);

    if (!vehicle) {
      this.logger.warn(
        `Dealership ${dealershipId}: Vehicle with id ${id} not found.`,
      );
      throw new NotFoundException(`Vehicle with ID "${id}" not found`);
    }

    this.logger.log(`Updating vehicle with id: ${id}`);
    const updatedVehicle = await vehicle.update({
      ...updateVehicleDto,
      dealershipId,
    });
    return updatedVehicle;
  }

  async remove(id: number, dealershipId: string): Promise<void> {
    const vehicle = await this.findVehicleById(id, dealershipId);

    this.logger.log(
      `Dealership ${dealershipId}: Deleting vehicle with id: ${id} (Soft Delete)`,
    );
    await vehicle.destroy();

    this.logger.log(
      `Dealership ${dealershipId}: Successfully soft-deleted vehicle with id: ${id}`,
    );
  }

  private async findVehicleById(
    id: number,
    dealershipId: string,
    includeDeleted: boolean = false,
  ): Promise<Vehicle> {
    this.logger.log(
      `Dealership ${dealershipId}: Attempting to fetch vehicle with id: ${id}, includeDeleted: ${includeDeleted}`,
    );

    const vehicle = await this.vehicleModel.findOne({
      where: { id, dealershipId },
      paranoid: !includeDeleted,
    });

    if (!vehicle) {
      this.logger.warn(
        `Dealership ${dealershipId}: Vehicle with id ${id} not found.`,
      );
      throw new NotFoundException(`Vehicle with ID "${id}" not found`);
    }

    return vehicle;
  }
}
