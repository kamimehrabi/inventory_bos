import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { LoginResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private logger: WinstonLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userService.validateUser(email, password);

    if (!user) {
      this.logger.warn(
        `Login attempt failed: Invalid credentials for ${email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      dealershipId: user.dealershipId,
    };

    const token = this.jwtService.sign(payload);

    this.logger.log(
      `JWT generated for user ${user.email} (Role: ${user.role}).`,
    );

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        dealershipId: user.dealershipId,
      },
    };
  }
}
