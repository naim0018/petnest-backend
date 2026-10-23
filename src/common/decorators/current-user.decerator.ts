import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {AuthenticatedUser} from '../guards/jwt-auth.guard'

export const CurrentUser = createParamDecorator((key: keyof AuthenticatedUser | undefined, ctx: ExecutionContext)
:AuthenticatedUser | any => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    return key ? user?.[key] : user
})