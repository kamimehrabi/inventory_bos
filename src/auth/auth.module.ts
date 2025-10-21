import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'src/common/logger/logger.module';
import { UserModule } from 'src/user/user.module';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
        },
      }),
    }),
  ],
  exports: [AuthGuard, RolesGuard, JwtModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
