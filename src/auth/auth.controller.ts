import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from 'src/user/user.model';
import { DealershipContext } from './decorators/dealership-context.decorator';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private logger: WinstonLogger,
  ) {
    this.logger.setContext(AuthController.name);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    this.logger.log(`Received login request for user: ${loginDto.email}.`);

    return this.authService.login(loginDto.email, loginDto.password);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('test')
  @HttpCode(HttpStatus.OK)
  async test(@DealershipContext() dealershipId: string): Promise<string> {
    return dealershipId;
  }
}
