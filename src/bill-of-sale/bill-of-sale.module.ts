import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BillOfSaleService } from './bill-of-sale.service';
import { BillOfSaleController } from './bill-of-sale.controller';
import { BillOfSale } from './bill-of-sale.model';
import { Vehicle } from 'src/vehicle/vehicle.model';
import { LoggerModule } from 'src/common/logger/logger.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    SequelizeModule.forFeature([BillOfSale, Vehicle]),
    LoggerModule,
    AuthModule,
  ],
  controllers: [BillOfSaleController],
  providers: [BillOfSaleService],
})
export class BillOfSaleModule {}
