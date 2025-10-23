import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { Vehicle } from './vehicle.model';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { LoggerModule } from 'src/common/logger/logger.module';
import { AuthModule } from 'src/auth/auth.module';
import { SequelizeQueryBuilderService } from 'src/common/database/sequelize-query-builder.service';
import { MinioModule } from 'src/common/storage/minio/minio.module';
import { RedisModule } from 'src/common/cache/redis/redis.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Vehicle]),
    LoggerModule,
    AuthModule,
    MinioModule,
    RedisModule,
  ],
  controllers: [VehicleController],
  providers: [VehicleService, SequelizeQueryBuilderService],
})
export class VehicleModule {}
