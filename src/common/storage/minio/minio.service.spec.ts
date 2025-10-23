/* eslint-disable @typescript-eslint/no-explicit-any */
// src/common/storage/minio/minio-client.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { MinioService } from './minio.service';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import * as Minio from 'minio'; // Import the actual Minio library to spy on it

// --- MOCK DEPENDENCIES ---

// 1. Mock Logger
const mockWinstonLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  // Add other methods used in the service
};

// 2. Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'MINIO_BUCKET_NAME') return 'test-bucket';
    if (key === 'MINIO_HOST') return 'mock-host';
    if (key === 'MINIO_PORT') return 9000;
    if (key === 'MINIO_ACCESS_KEY') return 'test-access';
    if (key === 'MINIO_SECRET_KEY') return 'test-secret';
    return null;
  }),
};

// 3. Mock Minio.Client and its methods
const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  // Note: Minio.Client itself is a class, we'll mock the constructor call
};

// Spy on the Minio.Client constructor to return our mock instance
jest
  .spyOn(Minio, 'Client')
  .mockImplementation(() => mockMinioClient as unknown as Minio.Client);

// --- CONSTANTS & MOCK DATA ---

const MOCK_FOLDER = 'dealer-1/vehicles/';
const MOCK_BUCKET = 'test-bucket';

// Mock Express.Multer.File object
const mockFile: Express.Multer.File = {
  fieldname: 'image',
  originalname: 'car-photo.png',
  encoding: '7bit',
  mimetype: 'image/png',
  size: 5000,
  stream: null,
  destination: '',
  filename: '',
  path: '',
  buffer: Buffer.from('mock file buffer'),
} as any;

describe('MinioService', () => {
  let service: MinioService;

  // Use a special setup to handle the constructor logic which calls Minio.Client
  beforeEach(async () => {
    // Reset spies and mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: WinstonLogger, useValue: mockWinstonLogger },
      ],
    }).compile();

    // The service is instantiated here, triggering the Minio.Client constructor call
    service = module.get<MinioService>(MinioService);
  });

  // Restore the Minio.Client spy after all tests are done
  afterAll(() => {
    (Minio.Client as jest.Mock).mockRestore();
  });

  it('should be defined and initialize Minio client', () => {
    expect(service).toBeDefined();
    expect(Minio.Client).toHaveBeenCalledWith(
      expect.objectContaining({
        endPoint: 'mock-host',
        port: 9000,
        accessKey: 'test-access',
      }),
    );
    expect(mockWinstonLogger.setContext).toHaveBeenCalledWith(
      MinioService.name,
    );
  });

  // ------------------------------------------------------------------
  // Constructor: Bucket Initialization
  // ------------------------------------------------------------------
  describe('Constructor (Bucket Setup)', () => {
    it('should create the bucket if it does not exist', async () => {
      // Mock the initial call when the service is instantiated
      mockMinioClient.bucketExists.mockResolvedValue(false);

      // Re-instantiate the service to trigger the constructor logic
      await Test.createTestingModule({
        providers: [
          MinioService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: WinstonLogger, useValue: mockWinstonLogger },
        ],
      }).compile();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(MOCK_BUCKET);
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
        MOCK_BUCKET,
        'us-east-1',
      );
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        `MinIO Bucket '${MOCK_BUCKET}' created successfully.`,
      );
    });

    it('should NOT create the bucket if it already exists', async () => {
      // Mock the initial call when the service is instantiated
      mockMinioClient.bucketExists.mockResolvedValue(true);

      // Re-instantiate the service
      await Test.createTestingModule({
        providers: [
          MinioService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: WinstonLogger, useValue: mockWinstonLogger },
        ],
      }).compile();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledWith(MOCK_BUCKET);

      (mockMinioClient.makeBucket as jest.Mock).mockClear();

      await Test.createTestingModule({
        providers: [
          MinioService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: WinstonLogger, useValue: mockWinstonLogger },
        ],
      }).compile();

      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('should log an error if bucket creation/check fails', async () => {
      const mockError = new Error('MinIO connection failed');
      mockMinioClient.bucketExists.mockRejectedValue(mockError);

      // Re-instantiate the service
      await Test.createTestingModule({
        providers: [
          MinioService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: WinstonLogger, useValue: mockWinstonLogger },
        ],
      }).compile();

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking/creating MinIO bucket'),
        expect.any(String),
      );
    });
  });

  // ------------------------------------------------------------------
  // UPLOAD
  // ------------------------------------------------------------------
  describe('upload', () => {
    it('should successfully upload a file and return the public URL path', async () => {
      // Setup mock: MinIO upload succeeds
      mockMinioClient.putObject.mockResolvedValue(true);

      // Act
      const result = await service.upload(mockFile, MOCK_FOLDER);

      // Assert
      // 1. Check if putObject was called correctly
      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        MOCK_BUCKET,
        expect.stringContaining(MOCK_FOLDER), // Check it's in the correct folder
        mockFile.buffer,
        mockFile.size,
        { 'Content-Type': mockFile.mimetype },
      );

      // 2. Check the returned path format
      const objectName = result.replace(`/${MOCK_BUCKET}/`, ''); // Extract the object name from the returned path
      expect(result).toMatch(
        /^\/test-bucket\/dealer-1\/vehicles\/\d+-image\.png$/,
      );

      // 3. Check logging
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(
        `Starting upload of file: ${objectName}`,
      );
      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        `Successfully uploaded object: ${objectName}`,
      );
    });

    it('should throw InternalServerErrorException if MinIO upload fails', async () => {
      const mockError = new Error('MinIO connection timed out');
      // Setup mock: MinIO upload fails
      mockMinioClient.putObject.mockRejectedValue(mockError);

      // Act & Assert
      await expect(service.upload(mockFile, MOCK_FOLDER)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.upload(mockFile, MOCK_FOLDER)).rejects.toThrow(
        'Failed to upload file.',
      );

      // Check error logging
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload file to MinIO'),
        mockError.stack,
      );
    });
  });
});
