/* eslint-disable @typescript-eslint/no-explicit-any */
// src/user/user.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getModelToken } from '@nestjs/sequelize';
import { User } from './user.model'; // Assuming you have this model
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import * as bcrypt from 'bcrypt';

// Mock the User model methods we use
const mockUserModel = {
  findOne: jest.fn(),
};

// Mock the WinstonLogger
const mockWinstonLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock bcrypt.compare
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let userModel;

  // Define a mock user object for successful scenarios
  const mockUser: User = {
    id: 1,
    email: 'test@dealer.com',
    passwordHash: 'hashedpassword123',
    role: 'dealer',
    dealershipId: 'd123',
    get: jest.fn().mockReturnValue({
      id: 1,
      email: 'test@dealer.com',
      role: 'dealer',
      dealershipId: 'd123',
    }),
  } as any as User;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: WinstonLogger,
          useValue: mockWinstonLogger,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get(getModelToken(User));

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test for findOneByEmail ---
  describe('findOneByEmail', () => {
    it('should return a user if found', async () => {
      userModel.findOne.mockResolvedValue(mockUser);
      const user = await service.findOneByEmail('test@dealer.com');

      expect(userModel.findOne).toHaveBeenCalledWith({
        where: { email: 'test@dealer.com' },
      });
      expect(user).toEqual(mockUser);
    });

    it('should return null if no user is found', async () => {
      userModel.findOne.mockResolvedValue(null);
      const user = await service.findOneByEmail('nonexistent@dealer.com');

      expect(user).toBeNull();
    });
  });

  // --- Test for validateUser ---
  describe('validateUser', () => {
    const email = 'test@dealer.com';
    const password = 'plainpassword';

    it('should return the user object (without hash) on successful validation', async () => {
      // Setup
      userModel.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validateUser(email, password);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.passwordHash,
      );
      expect(result).toEqual(mockUser.get({ plain: true }));
      expect(mockWinstonLogger.log).toHaveBeenCalled();
    });

    it('should return null if the user is not found', async () => {
      // Setup
      userModel.findOne.mockResolvedValue(null);

      // Act
      const result = await service.validateUser(email, password);

      // Assert
      expect(result).toBeNull();
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        `Validation attempt failed: User with email ${email} not found.`,
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null if the password is incorrect', async () => {
      // Setup
      userModel.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.validateUser(email, password);

      // Assert
      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        `Validation attempt failed: Password mismatch for user ${email}.`,
      );
    });
  });
});
