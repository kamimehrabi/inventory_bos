import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DealershipModule } from './dealership/dealership.module';

@Module({
  imports: [LoggerModule, AppConfigModule, DatabaseModule, DealershipModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
