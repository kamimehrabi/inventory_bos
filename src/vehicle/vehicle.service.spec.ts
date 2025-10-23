/* eslint-disable @typescript-eslint/no-explicit-any */
// src/vehicle/vehicle.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { VehicleService } from './vehicle.service';
import { getModelToken } from '@nestjs/sequelize';
import { Vehicle } from './vehicle.model';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { SequelizeQueryBuilderService } from 'src/common/database/sequelize-query-builder.service';
import { MinioService } from 'src/common/storage/minio/minio.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { GetVehiclesDto } from './dto/get-vehicles.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

// --- MOCK DEPENDENCIES ---

// 1. Mock the Sequelize Vehicle Model
const mockVehicleModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findAndCountAll: jest.fn(),
  // Mock instance methods that are used inside the service
  update: jest.fn(),
  destroy: jest.fn(),
};

// 2. Mock Logger
const mockWinstonLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 3. Mock Query Builder
const mockQueryBuilder = {
  buildQueryOptions: jest.fn(),
};

// 4. Mock Minio Service
const mockMinioService = {
  upload: jest.fn(),
};

// 5. Mock Cache Manager
// Note: We only mock the public 'get' and 'set' methods for list caching logic.
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  // Mock stores/client access used in invalidateCache (must be deeply mocked)
  stores: [
    { delete: jest.fn() }, // Mock L1 cache delete
    {
      // Mock L2 cache (Redis/KeyV)
      delete: jest.fn(),
      store: {
        client: {
          keys: jest.fn(),
        },
      },
    },
  ],
};

// --- CONSTANTS & MOCK DATA ---

const MOCK_DEALERSHIP_ID = 'dealer-test-1';
const MOCK_VEHICLE_ID = 101;

// Mock vehicle instance (must include update and destroy methods)
const mockVehicleInstance = {
  id: MOCK_VEHICLE_ID,
  vin: 'VIN123TEST',
  make: 'Honda',
  model: 'Civic',
  dealershipId: MOCK_DEALERSHIP_ID,
  update: jest.fn().mockImplementation(function (dto) {
    return Promise.resolve({ ...this, ...dto }); // Simulate update return
  }),
  destroy: jest.fn().mockResolvedValue(undefined),
} as any as Vehicle;

const createVehicleDto = {
  vin: 'NEWVIN456',
  make: 'Toyota',
  model: 'Camry',
  year: 2024,
  price: 30000,
} as any;

describe('VehicleService', () => {
  let service: VehicleService;
  let vehicleModel: typeof mockVehicleModel;
  let cacheManager: typeof mockCacheManager;
  let minioService: typeof mockMinioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehicleService,
        { provide: getModelToken(Vehicle), useValue: mockVehicleModel },
        { provide: WinstonLogger, useValue: mockWinstonLogger },
        { provide: SequelizeQueryBuilderService, useValue: mockQueryBuilder },
        { provide: MinioService, useValue: mockMinioService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<VehicleService>(VehicleService);
    vehicleModel = module.get(getModelToken(Vehicle));
    cacheManager = module.get(CACHE_MANAGER);
    minioService = module.get(MinioService);

    // Reset all mocks before each test
    jest.clearAllMocks();
    // Pre-configure the mock findOne for the private helper (used in findOne, update, remove, uploadImage)
    (vehicleModel.findOne as jest.Mock).mockImplementation((options) => {
      // Default mock for findVehicleById logic
      if (
        options.where.id === MOCK_VEHICLE_ID &&
        options.where.dealershipId === MOCK_DEALERSHIP_ID
      ) {
        return Promise.resolve(mockVehicleInstance);
      }
      return Promise.resolve(null);
    });
    // Mock the cache invalidation dependency to avoid complex mocking in every test
    (
      mockCacheManager.stores[1].store?.client.keys as jest.Mock
    ).mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ------------------------------------------------------------------
  // 16. Implement CRUD APIs: CREATE
  // ------------------------------------------------------------------
  describe('create', () => {
    it('should successfully create a new vehicle and invalidate cache', async () => {
      // 1. Setup: No existing vehicle (paranoid: false)
      (vehicleModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      // 2. Setup: Mock the creation
      (vehicleModel.create as jest.Mock).mockResolvedValue({
        id: MOCK_VEHICLE_ID,
        ...createVehicleDto,
        dealershipId: MOCK_DEALERSHIP_ID,
      } as any);
      // Mock cache invalidation helper dependencies
      (
        mockCacheManager.stores[1].store?.client.keys as jest.Mock
      ).mockResolvedValue(['key1', 'key2']);

      // Act
      const result = await service.create(MOCK_DEALERSHIP_ID, createVehicleDto);

      // Assert
      expect(vehicleModel.findOne).toHaveBeenCalledWith({
        where: { dealershipId: MOCK_DEALERSHIP_ID, vin: createVehicleDto.vin },
        paranoid: false,
      });
      expect(vehicleModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createVehicleDto,
          dealershipId: MOCK_DEALERSHIP_ID,
        }),
      );
      // Verify cache invalidation was attempted
      expect(
        mockCacheManager.stores[1].store?.client.keys,
      ).toHaveBeenCalledWith('vehicle_list_dealer-test-1:*');
      expect(mockCacheManager.stores[0].delete).toHaveBeenCalledTimes(2);
      expect(result.vin).toEqual(createVehicleDto.vin);
    });

    it('should throw ForbiddenException if vehicle VIN already exists', async () => {
      // Setup: Existing vehicle is found (even if soft-deleted)
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(
        mockVehicleInstance,
      );

      // Act & Assert
      await expect(
        service.create(MOCK_DEALERSHIP_ID, createVehicleDto),
      ).rejects.toThrow(ForbiddenException);
      expect(vehicleModel.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // 17. Implement CRUD APIs: FIND ALL (with Caching and Query Builder)
  // ------------------------------------------------------------------
  describe('findAll', () => {
    const query: GetVehiclesDto = { limit: 10, page: 1, sort: 'year' };
    const mockDbResult = { rows: [mockVehicleInstance], count: 1 };

    it('should return data from cache if cache HIT', async () => {
      // Setup: Cache HIT
      (cacheManager.get as jest.Mock).mockResolvedValue(mockDbResult);

      // Act
      const result = await service.findAll(MOCK_DEALERSHIP_ID, query);

      // Assert
      expect(result).toEqual(mockDbResult);
      expect(cacheManager.get).toHaveBeenCalled();
      expect(vehicleModel.findAndCountAll).not.toHaveBeenCalled(); // DB skipped
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cache HIT'),
      );
    });

    it('should fetch from DB, set cache, and return data if cache MISS', async () => {
      // 1. Setup: Cache MISS
      (cacheManager.get as jest.Mock).mockResolvedValue(null);
      // 2. Setup: Mock query options from builder
      const mockOptions = { limit: 10, offset: 0, order: [['year', 'ASC']] };
      (mockQueryBuilder.buildQueryOptions as jest.Mock).mockReturnValue(
        mockOptions,
      );
      // 3. Setup: Mock DB query result
      (vehicleModel.findAndCountAll as jest.Mock).mockResolvedValue(
        mockDbResult,
      );

      // Act
      const result = await service.findAll(MOCK_DEALERSHIP_ID, query);
      const cacheKey = service['getCacheKey'](MOCK_DEALERSHIP_ID, query);

      // Assert
      expect(vehicleModel.findAndCountAll).toHaveBeenCalledWith(mockOptions);
      expect(cacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        mockDbResult,
        60000,
      );
      expect(result).toEqual(mockDbResult);
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cache MISS'),
      );
    });
  });

  // ------------------------------------------------------------------
  // 16, 18. Implement CRUD APIs: FIND ONE (with Multi-tenancy and Soft Delete)
  // ------------------------------------------------------------------
  describe('findOne', () => {
    it('should successfully find a vehicle (default: not deleted)', async () => {
      // findVehicleById is mocked in beforeEach to return the instance
      const result = await service.findOne(MOCK_VEHICLE_ID, MOCK_DEALERSHIP_ID);

      expect(vehicleModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_VEHICLE_ID, dealershipId: MOCK_DEALERSHIP_ID },
          paranoid: true, // Default: exclude deleted
        }),
      );
      expect(result).toEqual(mockVehicleInstance);
    });

    it('should find a soft-deleted vehicle when includeDeleted is true', async () => {
      // findVehicleById is mocked in beforeEach to return the instance
      await service.findOne(MOCK_VEHICLE_ID, MOCK_DEALERSHIP_ID, true);

      expect(vehicleModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          paranoid: false, // include deleted
        }),
      );
    });

    it('should throw NotFoundException if vehicle ID does not exist', async () => {
      // Override the default mock to return null for findVehicleById's DB call
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999, MOCK_DEALERSHIP_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if vehicle ID exists but belongs to a different dealership', async () => {
      // Force the mock to return null even if the ID matches, because the dealershipId will not match
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne(MOCK_VEHICLE_ID, 'other-dealer-2'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ------------------------------------------------------------------
  // 16. Implement CRUD APIs: UPDATE
  // ------------------------------------------------------------------
  describe('update', () => {
    const updateDto: UpdateVehicleDto = { price: 55000 };

    it('should successfully update a vehicle and invalidate cache', async () => {
      // Setup: Mock findVehicleById (default mock returns mockVehicleInstance)

      // Act
      const result = await service.update(
        MOCK_VEHICLE_ID,
        updateDto,
        MOCK_DEALERSHIP_ID,
      );

      // Assert
      expect(mockVehicleInstance.update).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
      );
      // Verify the returned object contains the update
      expect(result.price).toEqual(updateDto.price);
      // Verify cache invalidation
      expect(mockCacheManager.stores[1].store?.client.keys).toHaveBeenCalled();
    });

    it('should throw NotFoundException if vehicle does not exist (handled by findVehicleById)', async () => {
      // Setup: Override findOne mock for the findVehicleById helper
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(999, updateDto, MOCK_DEALERSHIP_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ------------------------------------------------------------------
  // 16, 18. Implement CRUD APIs: REMOVE (Soft Delete)
  // ------------------------------------------------------------------
  describe('remove', () => {
    it('should successfully soft-delete a vehicle and invalidate cache', async () => {
      // Setup: Mock findVehicleById (default mock returns mockVehicleInstance)

      // Act
      await service.remove(MOCK_VEHICLE_ID, MOCK_DEALERSHIP_ID);

      // Assert
      expect(mockVehicleInstance.destroy).toHaveBeenCalled(); // Checks for Sequelize soft delete
      // Verify cache invalidation
      expect(mockCacheManager.stores[1].store?.client.keys).toHaveBeenCalled();
    });

    it('should throw NotFoundException if vehicle does not exist', async () => {
      // Setup: Override findOne mock for the findVehicleById helper
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(999, MOCK_DEALERSHIP_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockVehicleInstance.destroy).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // 20. File Handling: UPLOAD IMAGE
  // ------------------------------------------------------------------
  describe('uploadImage', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      stream: null,
      destination: '',
      filename: '',
      path: '',
      buffer: Buffer.from('test buffer'),
    } as any;
    const mockImageUrl =
      'http://minio/bucket/dealer-test-1/vehicles/101/image.jpg';

    it('should upload file, update vehicle, and invalidate cache', async () => {
      // Setup: Mock findVehicleById (default mock returns mockVehicleInstance)
      (minioService.upload as jest.Mock).mockResolvedValue(mockImageUrl);

      // Act
      const result = await service.uploadImage(
        MOCK_VEHICLE_ID,
        MOCK_DEALERSHIP_ID,
        mockFile,
      );
      const expectedFolder = `${MOCK_DEALERSHIP_ID}/vehicles/${MOCK_VEHICLE_ID}/`;

      // Assert
      expect(minioService.upload).toHaveBeenCalledWith(
        mockFile,
        expectedFolder,
      );
      expect(mockVehicleInstance.update).toHaveBeenCalledWith({
        imageUrl: mockImageUrl,
      });
      expect(result.imageUrl).toEqual(mockImageUrl);
      // Verify cache invalidation
      expect(mockCacheManager.stores[1].store?.client.keys).toHaveBeenCalled();
    });

    it('should throw BadRequestException if file is missing', async () => {
      // Act & Assert
      await expect(
        service.uploadImage(
          MOCK_VEHICLE_ID,
          MOCK_DEALERSHIP_ID,
          null as unknown as any,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(minioService.upload).not.toHaveBeenCalled();
      expect(mockVehicleInstance.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if vehicle is not found (handled by findVehicleById)', async () => {
      // Setup: Override findOne mock for the findVehicleById helper
      (vehicleModel.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.uploadImage(999, MOCK_DEALERSHIP_ID, mockFile),
      ).rejects.toThrow(NotFoundException);
      expect(minioService.upload).not.toHaveBeenCalled();
    });
  });
});
