import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL'),
        dialect: 'postgres',
        synchronize: true, //alter...
        autoLoadModels: true,
        logging: (msg) => console.log(`[DB] ${msg}`),
      }),
    }),
    SequelizeModule.forFeature([]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
