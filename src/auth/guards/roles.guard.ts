import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service';
import { UserRole } from 'src/user/user.model';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private logger: WinstonLogger,
  ) {
    this.logger.setContext(RolesGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error(
        'RolesGuard called without authenticated user (missing req.user).',
      );
      throw new ForbiddenException('User authentication data missing.');
    }

    // 3. Check if the user's role is in the list of required roles
    const hasPermission = requiredRoles.some((role) => user.role === role);

    if (!hasPermission) {
      this.logger.warn(
        `Access denied for user ${user.email}. Role '${user.role}' not in required roles: [${requiredRoles.join(', ')}].`,
      );
      throw new ForbiddenException(
        'You do not have the required permissions to access this resource.',
      );
    }

    this.logger.debug(
      `User ${user.email} with role '${user.role}' granted access.`,
    );
    return true;
  }
}
