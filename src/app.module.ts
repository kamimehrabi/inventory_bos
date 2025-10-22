import { Module } from '@nestjs/common';
import { LoggerModule } from './common/logger/logger.module';
import { AppConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { DealershipModule } from './dealership/dealership.module';
import { VehicleModule } from './vehicle/vehicle.module';
import { BillOfSaleModule } from './bill-of-sale/bill-of-sale.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MinioModule } from './common/storage/minio/minio.module';

@Module({
  imports: [
    LoggerModule,
    AppConfigModule,
    DatabaseModule,
    DealershipModule,
    VehicleModule,
    BillOfSaleModule,
    UserModule,
    AuthModule,
    MinioModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
