import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { Response } from 'express';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() payload: LoginDto, @Res({passthrough:true}) res: Response) {
    const {token,user} = await this.authService.login(payload);

    res.cookie('accessToken', token.accessToken,{
      httpOnly:true,
      secure : process.env.NODE_ENV==='production',
      sameSite:'lax',
      maxAge:60*60*1000,
    })
    res.cookie('refreshToken',token.refreshToken,{
      httpOnly:true,
      secure : process.env.NODE_ENV === "production",
      sameSite:'lax',
      maxAge:7*24*60*60*1000,
    })
    return{
      message:'User logged in successfully',
      user
    }
  }


  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  logout() {
    return this.authService.logout();
  }


  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() payload:RegisterDto){
    return this.authService.register(payload);
  }
}
