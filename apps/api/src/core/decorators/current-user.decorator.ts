/**
 * SHEHSWAR ONE360 - Current User Decorator
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '@shehswar/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
