import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const DealershipContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    return request.user.dealershipId;
  },
);
