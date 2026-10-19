import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { Request, Response } from 'express';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { extractVisitorInfo } from 'src/common/utils/Visitor-info.util';
import { CookieUtil } from 'src/common/utils/cookie.util';
import { CurrentSession } from 'src/common/decorators/current-session.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() payload: LoginDto, @Req() req:Request, @Res({passthrough:true}) res: Response) {
    
    const {ip,deviceInfo} = extractVisitorInfo(req);
   
    const {tokens,user} = await this.authService.login(payload,ip,deviceInfo);
    CookieUtil.setAuthCookies(res,tokens.accessToken,tokens.refreshToken)
    return{
      message:'User logged in successfully',
      user
    }
  }


  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@CurrentSession() sessionId:string | null ,@Res({passthrough:true}) res:Response) {
    await this.authService.logout(sessionId as string);
    CookieUtil.clearAuthCookies(res);
    return {
      message:'User logged out successfully'
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() payload:RegisterDto, @Req() req:Request, @Res({passthrough:true}) res:Response){
    const {ip,deviceInfo} = extractVisitorInfo(req);
    const {tokens,user} = await this.authService.register(payload,ip,deviceInfo)
    CookieUtil.setAuthCookies(res,tokens.accessToken,tokens.refreshToken);
    return{
      message:"User registered successfully",
      user
    }
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({summary:'Refresh token'})
  async refreshToken(
    @Req() req:Request,
    @Res({passthrough:true}) res:Response,
  ){
    const refreshToken= req.cookies?.refreshToken || req.headers?.authorization?.replace('Bearer ','');
    if(!refreshToken) throw new UnauthorizedException("No refresh token provided");

    const tokens = await this.authService.refreshToken(refreshToken);
    CookieUtil.setAuthCookies(res,tokens.accessToken,tokens.refreshToken);
    return {
      message:"Tokens refreshed successfully",
    }
  }

}
