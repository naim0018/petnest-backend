import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from "express"

export interface AuthenticatedUser {
  userId:string;
  role:string;
  sessionId:string;
} 

@Injectable()
export class JwtAuthGuard implements CanActivate {

  constructor (private readonly jwtService: JwtService, private readonly prisma:PrismaService ) {}
  
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const request = context.switchToHttp().getRequest();

    const token = this.extractToken(request);
    if(!token){
      throw new UnauthorizedException("Authentication token missing")
    }

    try {
      const payload = await this.jwtService.verifyAsync(token,{secret:process.env.JWT_SECRET})
       const session = await this.prisma.session.findFirst({
        where:{
          id:payload.sessionId,
          revokedAt:null,
          expiresAt:{gt:new Date()}
        }
       })
       if(!session){
        throw new UnauthorizedException("Session revoked or expired")
       }

       request["user"]= payload;
       return true;
     } catch (error) {
      if(error instanceof UnauthorizedException){
        throw error;
      }
      throw new UnauthorizedException("Invalid authentication token")
    }
  }
  private extractToken(req:Request):string | null {
    if(req.cookies?.accessToken) {
      return req.cookies.accessToken
    }
  
  const authHeader = req.headers.authorization;
  if(authHeader && authHeader.startsWith('Bearer ')){
    return authHeader.substring(7);
  }
  return null;
  }
}

