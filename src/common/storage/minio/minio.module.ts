import { Module } from '@nestjs/common';
import { MinioService } from './minio.service';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
