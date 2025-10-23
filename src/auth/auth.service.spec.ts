// src/auth/auth.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { UnauthorizedException } from '@nestjs/common';

// Define mock data for a validated user (from UserService)
const mockValidatedUser = {
  id: 1,
  email: 'test@dealer.com',
  role: 'dealer',
  dealershipId: 'd123',
};

// Mock UserService methods
const mockUserService = {
  validateUser: jest.fn(),
};

// Mock JwtService methods
const mockJwtService = {
  sign: jest.fn(),
};

// Mock WinstonLogger
const mockWinstonLogger = {
  setContext: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: mockUserService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: WinstonLogger, useValue: mockWinstonLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test for login ---
  describe('login', () => {
    const email = 'test@dealer.com';
    const password = 'password';
    const mockToken = 'mocked.jwt.token';

    it('should return a JWT and user data on successful login', async () => {
      // Setup
      (userService.validateUser as jest.Mock).mockResolvedValue(
        mockValidatedUser,
      );
      (jwtService.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = await service.login(email, password);

      // Assert
      expect(userService.validateUser).toHaveBeenCalledWith(email, password);

      const expectedPayload = {
        userId: mockValidatedUser.id,
        email: mockValidatedUser.email,
        role: mockValidatedUser.role,
        dealershipId: mockValidatedUser.dealershipId,
      };
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: mockValidatedUser.id,
          email: mockValidatedUser.email,
          role: mockValidatedUser.role,
          dealershipId: mockValidatedUser.dealershipId,
        },
      });
      expect(mockWinstonLogger.log).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if validation fails', async () => {
      // Setup
      (userService.validateUser as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userService.validateUser).toHaveBeenCalledWith(email, password);
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        `Login attempt failed: Invalid credentials for ${email}`,
      );
    });
  });
});
