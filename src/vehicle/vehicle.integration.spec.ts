// src/vehicle/vehicle.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SequelizeModule } from '@nestjs/sequelize';
import { VehicleModule } from './vehicle.module';
import { Vehicle } from './vehicle.model';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MinioService } from 'src/common/storage/minio/minio.service';

// --- MOCK External Dependencies ---
const mockMinioService = {
  upload: jest.fn().mockResolvedValue('mock-image-url'),
};
// The Cache Manager is mocked to control cache behavior
const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null), // Always miss cache by default
  set: jest.fn().mockResolvedValue(true),
  // Mock stores/keys for invalidation logic used in the service
  stores: [
    { delete: jest.fn() },
    {
      delete: jest.fn(),
      store: { client: { keys: jest.fn().mockResolvedValue([]) } },
    },
  ],
};

describe('VehicleController (Integration)', () => {
  let app: INestApplication;
  const DEALERSHIP_ID = 'integration-dealer-1';
  const CREATE_DTO = {
    vin: 'INTTEST1234',
    make: 'Tesla',
    model: 'Model Y',
    year: 2023,
    price: 55000,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        VehicleModule,
        // Use an in-memory SQLite database for fast, isolated testing
        SequelizeModule.forRoot({
          dialect: 'sqlite',
          storage: ':memory:', // Use in-memory database
          autoLoadModels: true,
          synchronize: true, // Auto-create tables for the test
        }),
      ],
    })
      .overrideProvider(MinioService)
      .useValue(mockMinioService)
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up the database and close the app
    const vehicleModel = app.get<typeof Vehicle>(Vehicle);

    // 2. Call the static method on the model class.
    await vehicleModel.truncate(); // 👈 This is the correct static call.

    await app.close();
  });

  // Clear mocks between individual tests
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- TEST CASES ---

  it('/POST vehicle should create a vehicle and invalidate cache', async () => {
    const response = await request(app.getHttpServer())
      .post('/vehicles')
      .set('x-dealership-id', DEALERSHIP_ID) // Simulate multi-tenancy header
      .send(CREATE_DTO)
      .expect(201);

    expect(response.body.vin).toEqual(CREATE_DTO.vin);
    expect(response.body.dealershipId).toEqual(DEALERSHIP_ID);

    // Verify integration between Controller -> Service -> DB -> Caching Invalidator
    expect(mockCacheManager.stores[1].store?.client.keys).toHaveBeenCalled();
  });

  it('/GET vehicles should retrieve the created vehicle', async () => {
    const response = await request(app.getHttpServer())
      .get('/vehicles?limit=1')
      .set('x-dealership-id', DEALERSHIP_ID)
      .expect(200);

    expect(response.body.count).toBeGreaterThanOrEqual(1);
    expect(response.body.rows[0].vin).toEqual(CREATE_DTO.vin);

    // Verify integration between Controller -> Service -> DB -> Caching Setter
    expect(mockCacheManager.get).toHaveBeenCalled(); // Should be cache MISS here
    expect(mockCacheManager.set).toHaveBeenCalled(); // Should set cache
  });

  it('/GET vehicles should return a 404 for a different dealership (multi-tenancy)', async () => {
    await request(app.getHttpServer())
      .get(`/vehicles/${1}`) // Assuming ID 1 was created
      .set('x-dealership-id', 'DIFFERENT-DEALER')
      .expect(404);
  });
});
