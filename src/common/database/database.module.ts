import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/user.model';
import { Dealership } from 'src/dealership/dealership.model';
import { Vehicle } from 'src/vehicle/vehicle.model';
import { BillOfSale } from 'src/bill-of-sale/bill-of-sale.model';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
        dialect: 'postgres',
        synchronize: true,
        // alter: true,
        autoLoadModels: true,
        logging: (msg) => console.log(`[DB] ${msg}`),
      }),
    }),
    SequelizeModule.forFeature([User, Dealership, Vehicle, BillOfSale]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
