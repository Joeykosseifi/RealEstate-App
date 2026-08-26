import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Only usable on routes protected by `@RequirePlatformPermission`. */
export const CurrentPlatformPermissions = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Set<string> => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ platformPermissions: Set<string> }>();
    return request.platformPermissions;
  },
);
