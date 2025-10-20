import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [LoggerModule, AppConfigModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
