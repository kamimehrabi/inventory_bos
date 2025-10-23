import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Vehicle } from './vehicle.model';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { GetVehiclesDto } from './dto/get-vehicles.dto';
import {
  QueryConfig,
  SequelizeQueryBuilderService,
} from 'src/common/database/sequelize-query-builder.service';
import { MinioService } from 'src/common/storage/minio/minio.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class VehicleService {
  private readonly vehicleQueryConfig: QueryConfig<Vehicle> = {
    searchFields: ['vin', 'make', 'model'],
    sortableFields: [
      'year',
      'make',
      'model',
      'price',
      'createdAt',
      'updatedAt',
    ],
  };

  private readonly VEHICLE_CACHE_KEY = 'vehicles_by_dealership';

  constructor(
    @InjectModel(Vehicle)
    private readonly vehicleModel: typeof Vehicle,
    private readonly logger: WinstonLogger,
    private readonly queryBuilder: SequelizeQueryBuilderService,
    private readonly minioService: MinioService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    await this.invalidateCache(); // Clear cache after successful creation
    return vehicle;
  }

  async findAll(
    dealershipId: string,
    query: GetVehiclesDto,
  ): Promise<{ rows: Vehicle[]; count: number }> {
    this.logger.log(
      `Dealership ${dealershipId}: Fetching vehicles with query: ${JSON.stringify(query)}`,
    );

    const baseWhere = { dealershipId };

    const options = this.queryBuilder.buildQueryOptions<Vehicle>(
      query,
      this.vehicleQueryConfig,
      baseWhere,
    );

    const vehicles = await this.vehicleModel.findAndCountAll(options);

    this.logger.log(
      `Dealership ${dealershipId}: Found ${vehicles.count} vehicles in total, returning page ${query.page || 1}.`,
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

    this.logger.log(`Updating vehicle with id: ${id}`);
    const updatedVehicle = await vehicle.update({
      ...updateVehicleDto,
      dealershipId,
    });
    await this.invalidateCache(); // Clear cache after successful creation
    return updatedVehicle;
  }

  async remove(id: number, dealershipId: string): Promise<void> {
    const vehicle = await this.findVehicleById(id, dealershipId);

    this.logger.log(
      `Dealership ${dealershipId}: Deleting vehicle with id: ${id} (Soft Delete)`,
    );
    await vehicle.destroy();
    await this.invalidateCache(); // Clear cache after successful creation

    this.logger.log(
      `Dealership ${dealershipId}: Successfully soft-deleted vehicle with id: ${id}`,
    );
  }

  async uploadImage(
    vehicleId: number,
    dealershipId: string,
    file: Express.Multer.File,
  ): Promise<Vehicle> {
    const vehicle = await this.findVehicleById(vehicleId, dealershipId);

    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    this.logger.log(
      `Dealership ${dealershipId}: Uploading image for vehicle ${vehicleId}`,
    );

    const folder = `${dealershipId}/vehicles/${vehicleId}/`;
    const imageUrl = await this.minioService.upload(file, folder);

    const updatedVehicle = await vehicle.update({ imageUrl });

    await this.invalidateCache(); // Clear cache after successful creation

    this.logger.log(
      `Dealership ${dealershipId}: Image uploaded and vehicle ${vehicleId} updated.`,
    );

    return updatedVehicle;
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

  private async invalidateCache() {
    this.cacheManager.del(this.VEHICLE_CACHE_KEY);
  }
}
