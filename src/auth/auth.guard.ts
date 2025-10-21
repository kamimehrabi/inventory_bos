import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtSecret?: string;

  constructor(
    private jwtService: JwtService,
    private logger: WinstonLogger,
    configService: ConfigService,
  ) {
    this.jwtSecret = configService.get<string>('JWT_SECRET');
    this.logger.setContext(AuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token missing.');
    }

    try {
      const payload = await this.jwtService.verify(token, {
        secret: this.jwtSecret,
      });

      request['user'] = payload;

      this.logger.debug(
        `Token successfully validated for user ID: ${payload.userId}`,
      );
    } catch (error) {
      this.logger.warn(`JWT validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token.');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
