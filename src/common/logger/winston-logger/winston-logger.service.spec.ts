// src/common/logger/winston-logger/winston-logger.service.spec.ts

import { WinstonLogger } from './winston-logger.service';
import * as winston from 'winston';

// Mock the winston logger instance and its methods
const mockWinstonLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  // Ensure the mock has the necessary properties/methods
} as unknown as winston.Logger;

// Spy on winston.createLogger to intercept the logger instance
const createLoggerSpy = jest
  .spyOn(winston, 'createLogger')
  .mockReturnValue(mockWinstonLogger);

describe('WinstonLogger', () => {
  let loggerService: WinstonLogger;
  const DEFAULT_MESSAGE = 'Test log message';
  const DEFAULT_CONTEXT = 'TestContext';
  const OVERRIDE_CONTEXT = 'OverrideContext';

  beforeEach(() => {
    jest.clearAllMocks();

    loggerService = new WinstonLogger();
  });

  afterAll(() => {
    // Restore the original winston.createLogger implementation
    createLoggerSpy.mockRestore();
  });

  it('should be defined and call winston.createLogger on instantiation', () => {
    expect(loggerService).toBeDefined();
    // The spy is called once during the initial setup before 'beforeEach' runs
    expect(winston.createLogger).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Context Management
  // ------------------------------------------------------------------
  describe('setContext', () => {
    it('should set the default context for the logger instance', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.log(DEFAULT_MESSAGE);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: DEFAULT_CONTEXT,
      });
    });
  });

  // ------------------------------------------------------------------
  // Log Methods (Implementing LoggerService Interface)
  // ------------------------------------------------------------------
  describe('log (info level)', () => {
    it('should call winston.info with the message and NO context if none is set', () => {
      loggerService.log(DEFAULT_MESSAGE);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: undefined,
      });
    });

    it('should call winston.info with the message and the SET context', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.log(DEFAULT_MESSAGE);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: DEFAULT_CONTEXT,
      });
    });

    it('should call winston.info with the message and the PROVIDED context (override)', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.log(DEFAULT_MESSAGE, OVERRIDE_CONTEXT);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: OVERRIDE_CONTEXT,
      });
    });
  });

  describe('error', () => {
    const TRACE = 'Error stack trace details';

    it('should call winston.error with message, trace, and context', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.error(DEFAULT_MESSAGE, TRACE);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: DEFAULT_CONTEXT,
        trace: TRACE,
      });
    });

    it('should handle missing trace argument gracefully', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.error(DEFAULT_MESSAGE);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: DEFAULT_CONTEXT,
        trace: undefined,
      });
    });

    it('should use provided context even if global context is set', () => {
      loggerService.setContext(DEFAULT_CONTEXT);
      loggerService.error(DEFAULT_MESSAGE, TRACE, OVERRIDE_CONTEXT);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: OVERRIDE_CONTEXT,
        trace: TRACE,
      });
    });
  });

  describe('warn', () => {
    it('should call winston.warn with the message and context', () => {
      loggerService.warn(DEFAULT_MESSAGE, OVERRIDE_CONTEXT);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: OVERRIDE_CONTEXT,
      });
    });
  });

  describe('debug', () => {
    it('should call winston.debug with the message and context', () => {
      loggerService.debug(DEFAULT_MESSAGE, OVERRIDE_CONTEXT);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: OVERRIDE_CONTEXT,
      });
    });
  });

  describe('verbose', () => {
    it('should call winston.verbose with the message and context', () => {
      loggerService.verbose(DEFAULT_MESSAGE, OVERRIDE_CONTEXT);

      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith(DEFAULT_MESSAGE, {
        context: OVERRIDE_CONTEXT,
      });
    });
  });
});
