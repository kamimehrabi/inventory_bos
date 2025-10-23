import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { MarketingSyncController } from './marketing-sync.controller';
import { MarketingSyncProducer } from './marketing-sync-producer/marketing-sync-producer.service';
import { MarketingSyncProcessor } from './marketing-sync-processor.service';
import { MarketingSyncConsumer } from './marketing-sync-consumer/marketing-sync-consumer.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Vehicle } from 'src/vehicle/vehicle.model';
import { Dealership } from 'src/dealership/dealership.model';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    LoggerModule,
    SequelizeModule.forFeature([Dealership, Vehicle]),
    JwtModule,
  ],
  controllers: [MarketingSyncController],
  providers: [
    MarketingSyncProducer,
    MarketingSyncProcessor,
    MarketingSyncConsumer,
  ],

  exports: [MarketingSyncProducer],
})
export class MarketingSyncModule {}
