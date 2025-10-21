import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

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
}
