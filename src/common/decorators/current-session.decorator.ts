import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export const CurrentSession = createParamDecorator((data:unknown,ctx:ExecutionContext)=>{
    const request = ctx.switchToHttp().getRequest();
    const token = request.cookies?.accessToken ||request.cookies?.refreshToken||request.headers?.authorization?.split(' ')[1]
    if(!token) return null;
    try {
        const jwtService = new JwtService();
        const decoded = jwtService.decode(token)as {sessionId?:string, userId?:string, role?:string}
        return decoded?.sessionId || null;
    } catch (error) {
        console.log('JWT Decode error', error)
        return null;
    }
    }
)