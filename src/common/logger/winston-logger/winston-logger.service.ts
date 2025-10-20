import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class WinstonLogger implements LoggerService {
  private readonly logger: winston.Logger;
  private context?: string;

  constructor() {
    const transports = [
      new winston.transports.Console({
        level: 'silly',
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          // Custom log format: [Timestamp] [Context] Level: Message
          winston.format.printf(
            ({ level, message, timestamp, context }) =>
              `${timestamp} [\x1b[33m${context || this.context}\x1b[39m] ${level}: ${message}`,
          ),
        ),
      }),
      new winston.transports.File({
        level: 'info',
        filename: 'application.log',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(),
        ),
      }),
    ];

    this.logger = winston.createLogger({
      level: 'silly',
      transports,
    });
  }

  public setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context: context || this.context, trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }
}
