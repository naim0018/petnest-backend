import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../guards/jwt-auth.guard';

/**
 * Extracts the verified sessionId attached by JwtAuthGuard.
 * Never decodes unverified tokens directly.
 */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return request.user?.sessionId ?? null;
  },
);
