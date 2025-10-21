import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from './user.model';
import { LoggerModule } from 'src/common/logger/logger.module';

@Module({
  imports: [SequelizeModule.forFeature([User]), LoggerModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
