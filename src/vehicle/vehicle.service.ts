/* eslint-disable @typescript-eslint/no-explicit-any */
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

interface CachedVehicleList {
  rows: Vehicle[];
  count: number;
}

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

  private readonly VEHICLE_LIST_PREFIX = 'vehicle_list_';
  private readonly CACHE_TTL = 60000;

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

  private getCacheKey(dealershipId: string, query: GetVehiclesDto): string {
    const queryString = JSON.stringify(query);
    return `${this.VEHICLE_LIST_PREFIX}${dealershipId}:${queryString}`;
  }

  private async invalidateCache(dealershipId: string): Promise<void> {
    const pattern = `${this.VEHICLE_LIST_PREFIX}${dealershipId}:*`;
    this.logger.log(`Invalidating cache keys matching pattern: ${pattern}`);

    try {
      const keyvRedisStore = this.cacheManager.stores[1];

      let client: any = (keyvRedisStore as any).opts?.store?.client;

      if (!client) {
        client = (keyvRedisStore as any).store?.client;
      }

      if (!client || typeof client.keys !== 'function') {
        this.logger.error(
          'Failed to access underlying Redis client or keys() method via Keyv store. Check Keyv Redis compatibility.',
        );
        return;
      }

      const keys: string[] = await client.keys(pattern);

      if (keys && keys.length > 0) {
        this.logger.log(`Keys found for deletion: ${keys.join(', ')}`); // LOG THE KEYS BEING DELETED

        const deletePromises = keys.flatMap((key) => [
          (this.cacheManager.stores[0] as any).delete(key),
          (this.cacheManager.stores[1] as any).delete(key),
        ]);

        await Promise.all(deletePromises);

        this.logger.log(
          `Successfully deleted ${keys.length} cache entries for dealership ${dealershipId} from both layers.`,
        );
      } else {
        this.logger.log(
          `No cache entries found to delete for dealership ${dealershipId} with pattern ${pattern}.`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to invalidate cache keys:', error.stack);
    }
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
    } as any);

    await this.invalidateCache(dealershipId);
    return vehicle;
  }

  async findAll(
    dealershipId: string,
    query: GetVehiclesDto,
  ): Promise<{ rows: Vehicle[]; count: number }> {
    const cacheKey = this.getCacheKey(dealershipId, query);

    const cachedData = await this.cacheManager.get<CachedVehicleList>(cacheKey);
    if (cachedData) {
      this.logger.log(
        `Dealership ${dealershipId}: Cache HIT for key ${cacheKey}.`,
      );
      return cachedData;
    }

    this.logger.log(
      `Dealership ${dealershipId}: Cache MISS for key ${cacheKey}. Fetching from DB.`,
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

    await this.cacheManager.set(cacheKey, vehicles, this.CACHE_TTL);
    this.logger.log(
      `Dealership ${dealershipId}: Set cache for key ${cacheKey}.`,
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

    await this.invalidateCache(dealershipId);
    return updatedVehicle;
  }

  async remove(id: number, dealershipId: string): Promise<void> {
    const vehicle = await this.findVehicleById(id, dealershipId);

    this.logger.log(
      `Dealership ${dealershipId}: Deleting vehicle with id: ${id} (Soft Delete)`,
    );
    await vehicle.destroy();

    await this.invalidateCache(dealershipId);

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

    await this.invalidateCache(dealershipId);

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
}
