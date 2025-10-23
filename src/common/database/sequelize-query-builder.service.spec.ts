/* eslint-disable @typescript-eslint/no-explicit-any */
// src/common/sequelize/sequelize-query-builder.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Op } from 'sequelize';
import {
  SequelizeQueryBuilderService,
  QueryConfig,
} from './sequelize-query-builder.service';
import { GetVehiclesDto } from 'src/vehicle/dto/get-vehicles.dto';

// Define a mock model structure for testing
interface MockVehicleModel {
  id: number;
  make: string;
  model: string;
  price: number;
  createdAt: Date;
  deletedAt: Date | null;
}

// Define the static configuration for the builder
const mockConfig: QueryConfig<MockVehicleModel> = {
  searchFields: ['make', 'model'],
  sortableFields: ['id', 'price', 'createdAt'],
  // filterableFields are not used in your current implementation, so we omit them for simplicity
};

describe('SequelizeQueryBuilderService', () => {
  let service: SequelizeQueryBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SequelizeQueryBuilderService],
    }).compile();

    service = module.get<SequelizeQueryBuilderService>(
      SequelizeQueryBuilderService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ------------------------------------------------------------------
  // 1. Pagination Tests
  // ------------------------------------------------------------------
  describe('Pagination', () => {
    it('should use default page (1) and limit (10)', () => {
      const query: GetVehiclesDto = {};
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.limit).toBe(10);
      expect(options.offset).toBe(0);
    });

    it('should correctly calculate offset for a specific page and limit', () => {
      const query: GetVehiclesDto = { page: 3, limit: 20 };
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.limit).toBe(20);
      // Offset should be (3 - 1) * 20 = 40
      expect(options.offset).toBe(40);
    });
  });

  // ------------------------------------------------------------------
  // 2. Sorting Tests
  // ------------------------------------------------------------------
  describe('Sorting', () => {
    it('should apply default sort (createdAt, DESC) when no sort parameter is provided', () => {
      const query: GetVehiclesDto = {};
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.order).toEqual([['createdAt', 'DESC']]);
    });

    it('should correctly apply a valid sort parameter (ASC)', () => {
      const query: GetVehiclesDto = { sort: 'price:asc' };
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.order).toEqual([['price', 'ASC']]);
    });

    it('should correctly apply a valid sort parameter (DESC)', () => {
      const query: GetVehiclesDto = { sort: 'id:desc' };
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.order).toEqual([['id', 'DESC']]);
    });

    it('should throw BadRequestException for a non-sortable field', () => {
      const query: GetVehiclesDto = { sort: 'model:asc' }; // 'model' is not in sortableFields

      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        BadRequestException,
      );
      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        "Sorting by field 'model' is not allowed.",
      );
    });

    it('should throw BadRequestException for an invalid sort format', () => {
      const query: GetVehiclesDto = { sort: 'price:up' };

      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        BadRequestException,
      );
      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        'Invalid sort parameter format. Use "field:direction".',
      );
    });

    it('should throw BadRequestException for an invalid sort direction', () => {
      const query: GetVehiclesDto = { sort: 'price:up' };

      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        BadRequestException,
      );
      expect(() => service.buildQueryOptions(query, mockConfig)).toThrow(
        'Invalid sort parameter format. Use "field:direction".',
      );
    });
  });

  // ------------------------------------------------------------------
  // 3. Search (Filter) Tests
  // ------------------------------------------------------------------
  describe('Search/Filter', () => {
    it('should add Op.or condition for searching across multiple fields', () => {
      const query: GetVehiclesDto = { filter: 'honda' };
      const options = service.buildQueryOptions(query, mockConfig);

      const expectedSearchConditions = [
        { make: { [Op.iLike]: '%honda%' } },
        { model: { [Op.iLike]: '%honda%' } },
      ];

      expect(options.where![Op.and]).toBeDefined();
      expect(options.where![Op.and]).toEqual([
        { [Op.or]: expectedSearchConditions },
      ]);
    });

    it('should do nothing if filter is present but searchFields is empty', () => {
      const query: GetVehiclesDto = { filter: 'test' };
      const emptyConfig = { ...mockConfig, searchFields: [] };
      const options = service.buildQueryOptions(query, emptyConfig);

      // Where clause should be empty object
      expect(options.where).toEqual({});
    });

    it('should maintain initialWhere conditions when search is applied', () => {
      const query: GetVehiclesDto = { filter: 'fast' };
      const initialWhere = { id: { [Op.gt]: 50 } };
      const options = service.buildQueryOptions(
        query,
        mockConfig,
        initialWhere,
      );
      const where = options.where as any;

      expect(where[Op.and]).toBeDefined();

      // The initialWhere should be merged into the where clause
      expect(where.id).toEqual({ [Op.gt]: 50 });

      // The search filter should be pushed into Op.and
      const searchConditions = where[Op.and] as any[];
      expect(searchConditions.length).toBe(1);
      expect(searchConditions[0][Op.or]).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // 4. Paranoia (Soft Delete) Tests
  // ------------------------------------------------------------------
  describe('Paranoia (includeDeleted)', () => {
    it('should enable paranoia by default (paranoid: true)', () => {
      const query: GetVehiclesDto = {}; // includeDeleted is undefined/false
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.paranoid).toBe(true);
    });

    it('should disable paranoia when includeDeleted is true (paranoid: false)', () => {
      const query: GetVehiclesDto = { includeDeleted: true };
      const options = service.buildQueryOptions(query, mockConfig);

      expect(options.paranoid).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // 5. Integration/Comprehensive Tests
  // ------------------------------------------------------------------
  describe('Comprehensive Query', () => {
    it('should build a complete query object with all parameters', () => {
      const query: GetVehiclesDto = {
        page: 2,
        limit: 5,
        sort: 'price:DESC',
        filter: 'luxury',
        includeDeleted: true,
      };

      const initialWhere = { make: 'Ferrari' };

      const options = service.buildQueryOptions(
        query,
        mockConfig,
        initialWhere,
      );

      const where = options.where as any;

      expect(where[Op.and]).toBeDefined();

      const searchConditions = where[Op.and] as any[];

      expect(searchConditions[0][Op.or]).toBeDefined();

      expect(where).toHaveProperty('make', 'Ferrari');

      const expectedOptions = {
        where: {
          make: 'Ferrari',
          [Op.and]: [
            {
              [Op.or]: [
                { make: { [Op.iLike]: '%luxury%' } },
                { model: { [Op.iLike]: '%luxury%' } },
              ],
            },
          ],
        },
        limit: 5,
        offset: 5, // (2 - 1) * 5
        order: [['price', 'DESC']],
        paranoid: false,
      };

      // We use expect.objectContaining and deep equality for safety
      expect(options).toEqual(expectedOptions);
    });
  });
});
