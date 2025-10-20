import { Module } from '@nestjs/common';
import { WinstonLogger } from './winston-logger/winston-logger.service';

@Module({
  providers: [WinstonLogger],
  exports: [WinstonLogger],
})
export class LoggerModule {}
