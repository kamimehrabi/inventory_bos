/* eslint-disable @typescript-eslint/no-explicit-any */
// src/bill-of-sale/bill-of-sale.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BillOfSaleService } from './bill-of-sale.service';
import { getModelToken } from '@nestjs/sequelize';
import { BillOfSale, BosStatus } from './bill-of-sale.model'; // Assuming these exist
import { Vehicle } from 'src/vehicle/vehicle.model'; // Assuming this exists
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { Sequelize } from 'sequelize-typescript';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Op } from 'sequelize';
import { UpdateBillOfSaleDto } from './dto/update-bill-of-sale.dto';

// --- MOCK DEPENDENCIES ---

// 1. Mock the Sequelize BillOfSale Model methods
const mockBosModel = {
  findOne: jest.fn(),
  create: jest.fn(),
};

// 2. Mock the Sequelize Vehicle Model methods
const mockVehicleModel = {
  findOne: jest.fn(),
};

// 3. Mock Logger
const mockWinstonLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 4. Mock Sequelize (we usually don't need to mock this extensively for service unit tests)
const mockSequelize = {} as any as Sequelize;

// --- CONSTANTS & MOCK DATA ---

const MOCK_DEALERSHIP_ID = 'dealer-test-1';
const MOCK_VEHICLE_ID = 50;
const MOCK_BOS_ID = 10;

// Mock Vehicle instance found during creation check
const mockVehicleInstance = {
  id: MOCK_VEHICLE_ID,
  dealershipId: MOCK_DEALERSHIP_ID,
} as any as Vehicle;

// Mock BillOfSale instance (must include update and dataValues for update check)
const mockBosInstance = {
  id: MOCK_BOS_ID,
  dealershipId: MOCK_DEALERSHIP_ID,
  vehicleId: MOCK_VEHICLE_ID,
  finalPrice: 20000,
  bosStatus: BosStatus.DRAFT,
  dataValues: {
    // Used in your service for update logic
    id: MOCK_BOS_ID,
    vehicleId: MOCK_VEHICLE_ID,
  },
  update: jest.fn().mockImplementation(function (dto) {
    return Promise.resolve({
      ...this,
      ...dto,
      bosStatus: dto.bosStatus || this.bosStatus,
    });
  }),
} as any as BillOfSale;

// Create DTO
const createBosDto = {
  vehicleId: MOCK_VEHICLE_ID,
  finalPrice: 25000.0,
  buyerName: 'John Doe',
  buyerAddress: '123 Test St',
  // bosStatus is defaulted to SOLD in the service if not provided, but let's test PENDING first
  bosStatus: BosStatus.DRAFT,
} as any;

describe('BillOfSaleService', () => {
  let service: BillOfSaleService;
  let bosModel: typeof mockBosModel;
  let vehicleModel: typeof mockVehicleModel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillOfSaleService,
        { provide: getModelToken(BillOfSale), useValue: mockBosModel },
        { provide: getModelToken(Vehicle), useValue: mockVehicleModel },
        { provide: WinstonLogger, useValue: mockWinstonLogger },
        { provide: Sequelize, useValue: mockSequelize },
      ],
    }).compile();

    service = module.get<BillOfSaleService>(BillOfSaleService);
    bosModel = module.get(getModelToken(BillOfSale));
    vehicleModel = module.get(getModelToken(Vehicle));

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ------------------------------------------------------------------
  // findOne & findBosById (Retrieval & Multi-Tenancy)
  // ------------------------------------------------------------------
  describe('findOne', () => {
    it('should successfully return a BOS by ID and dealership', async () => {
      bosModel.findOne.mockResolvedValue(mockBosInstance);

      const result = await service.findOne(MOCK_BOS_ID, MOCK_DEALERSHIP_ID);

      expect(bosModel.findOne).toHaveBeenCalledWith({
        where: { id: MOCK_BOS_ID, dealershipId: MOCK_DEALERSHIP_ID },
      });
      expect(result).toEqual(mockBosInstance);
    });

    it('should throw NotFoundException if BOS does not exist or tenant mismatch', async () => {
      bosModel.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, MOCK_DEALERSHIP_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ------------------------------------------------------------------
  // 21. CREATE (POST /bills-of-sale)
  // ------------------------------------------------------------------
  describe('create', () => {
    it('should successfully create a new BOS with default status SOLD', async () => {
      const soldDto = { ...createBosDto };
      delete soldDto.bosStatus; // Test the default value

      // Setup: Vehicle exists, no existing SOLD BOS
      vehicleModel.findOne.mockResolvedValue(mockVehicleInstance);
      bosModel.findOne.mockResolvedValue(null);
      bosModel.create.mockResolvedValue({
        id: 11,
        ...soldDto,
        bosStatus: BosStatus.SOLD,
      });

      // Act
      const result = await service.create(MOCK_DEALERSHIP_ID, soldDto);

      // Assert
      expect(vehicleModel.findOne).toHaveBeenCalled();
      // Check for isVehicleAlreadySold check (called when bosStatus is SOLD)
      expect(bosModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { vehicleId: MOCK_VEHICLE_ID, bosStatus: BosStatus.SOLD },
        }),
      );
      expect(bosModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bosStatus: BosStatus.SOLD,
          dealershipId: MOCK_DEALERSHIP_ID,
        }),
      );
      expect(result.bosStatus).toBe(BosStatus.SOLD);
    });

    it('should successfully create a BOS with PENDING status (skipping sold check)', async () => {
      // Setup: Vehicle exists
      vehicleModel.findOne.mockResolvedValue(mockVehicleInstance);
      bosModel.create.mockResolvedValue({
        id: 12,
        ...createBosDto,
        bosStatus: BosStatus.DRAFT,
      });

      // Act
      const result = await service.create(MOCK_DEALERSHIP_ID, createBosDto);

      // Assert
      expect(vehicleModel.findOne).toHaveBeenCalled();
      // isVehicleAlreadySold is NOT called when status is PENDING
      expect(bosModel.findOne).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { bosStatus: BosStatus.SOLD } }),
      );
      expect(bosModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ bosStatus: BosStatus.DRAFT }),
      );
      expect(result.bosStatus).toBe(BosStatus.DRAFT);
    });

    it('should throw NotFoundException if vehicle does not exist in dealership', async () => {
      // Setup: Vehicle does not exist
      vehicleModel.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create(MOCK_DEALERSHIP_ID, createBosDto),
      ).rejects.toThrow(NotFoundException);
      expect(bosModel.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if vehicle is already sold and new status is SOLD', async () => {
      const soldDto = { ...createBosDto };
      delete soldDto.bosStatus; // Test the default value of SOLD

      // Setup: Vehicle exists, AND an existing SOLD BOS is found
      vehicleModel.findOne.mockResolvedValue(mockVehicleInstance);
      bosModel.findOne.mockResolvedValue({ id: 5, bosStatus: BosStatus.SOLD }); // Existing SOLD BOS

      // Act & Assert
      await expect(service.create(MOCK_DEALERSHIP_ID, soldDto)).rejects.toThrow(
        ConflictException,
      );
      expect(bosModel.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------------
  describe('update', () => {
    const updateDto: UpdateBillOfSaleDto = {
      finalPrice: 35000,
      bosStatus: BosStatus.SOLD,
    };

    it('should return the original BOS if no changes are detected in DTO', async () => {
      // Setup: findBosById returns instance, DTO has no changes
      bosModel.findOne.mockResolvedValue(mockBosInstance);
      const noChangeDto: UpdateBillOfSaleDto = {};

      // Act
      const result = await service.update(
        MOCK_BOS_ID,
        MOCK_DEALERSHIP_ID,
        noChangeDto,
      );

      // Assert
      expect(result).toBe(mockBosInstance);
      expect(mockBosInstance.update).not.toHaveBeenCalled();
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No changes detected'),
      );
    });

    it('should successfully update price and status (PENDING to SOLD)', async () => {
      // Setup: findBosById returns an existing PENDING BOS
      bosModel.findOne.mockResolvedValue({
        ...mockBosInstance,
        bosStatus: BosStatus.DRAFT,
      });
      // Setup: No other BOS is SOLD (from isVehicleAlreadySold check)
      bosModel.findOne
        .mockResolvedValueOnce(mockBosInstance) // for findBosById
        .mockResolvedValueOnce(null); // for isVehicleAlreadySold

      // Act
      const result = await service.update(
        MOCK_BOS_ID,
        MOCK_DEALERSHIP_ID,
        updateDto,
      );

      // Assert
      // isVehicleAlreadySold should be called with exclusion
      expect(bosModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vehicleId: MOCK_VEHICLE_ID,
            bosStatus: BosStatus.SOLD,
            id: { [Op.ne]: MOCK_BOS_ID },
          },
        }),
      );
      expect(mockBosInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          finalPrice: 35000,
          bosStatus: BosStatus.SOLD,
        }),
      );
      expect(result.bosStatus).toBe(BosStatus.SOLD);
    });

    it('should throw ConflictException if updating status to SOLD when vehicle is already sold via another BOS', async () => {
      const initialBos = {
        ...mockBosInstance,
        id: MOCK_BOS_ID,
        bosStatus: BosStatus.DRAFT, // Start with PENDING
      };

      // 1. Setup: findBosById returns the PENDING instance we want to update
      bosModel.findOne.mockResolvedValueOnce(initialBos);
      // 2. Setup: isVehicleAlreadySold finds another SOLD BOS
      bosModel.findOne.mockResolvedValueOnce({
        id: MOCK_BOS_ID + 1,
        bosStatus: BosStatus.SOLD,
      });

      // Act & Assert
      await expect(
        service.update(MOCK_BOS_ID, MOCK_DEALERSHIP_ID, updateDto),
      ).rejects.toThrow(ConflictException);
      expect(mockBosInstance.update).not.toHaveBeenCalled();
    });

    it('should NOT check isVehicleAlreadySold if new status is not SOLD', async () => {
      const updateToPending: UpdateBillOfSaleDto = {
        bosStatus: BosStatus.DRAFT,
      };

      // Setup: findBosById returns instance, but currently APPROVED
      const approvedBos = {
        ...mockBosInstance,
        bosStatus: BosStatus.CANCELLED,
      };
      bosModel.findOne.mockResolvedValue(approvedBos);

      // Act
      await service.update(MOCK_BOS_ID, MOCK_DEALERSHIP_ID, updateToPending);

      // Assert: bosModel.findOne was called for findBosById, but not again for isVehicleAlreadySold
      expect(bosModel.findOne).toHaveBeenCalledTimes(1);
      expect(mockBosInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ bosStatus: BosStatus.DRAFT }),
      );
    });
  });
});
