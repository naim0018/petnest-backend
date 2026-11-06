import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto'
import { randomUUID } from 'crypto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
@Injectable()
export class AuthService {
  private readonly saltRounds: number = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

  constructor (private readonly prisma:PrismaService, private readonly jwtService:JwtService) {}
  
  async register(payload:RegisterDto,ip:string,deviceInfo:any){ 
    const {name,email,password,phone,interestedBreed,interestedSpecies} = payload;
  
    const existingUser = await this.prisma.user.findUnique({
      where: {email}
    })
  
    if (existingUser) throw new ConflictException("User already exists")
    const hashedPassword = await bcrypt.hash(password, this.saltRounds)
    if (interestedSpecies) {
      const speciesExists = await this.prisma.petSpecies.findUnique({
        where: { id: interestedSpecies },
      });
      if (!speciesExists) {
        throw new BadRequestException('Selected interested species does not exist');
      }
    }

    if (interestedBreed) {
      const breedExists = await this.prisma.petBreed.findUnique({
        where: { id: interestedBreed },
      });
      if (!breedExists) {
        throw new BadRequestException('Selected interested breed does not exist');
      }

      if (interestedSpecies && breedExists.speciesId !== interestedSpecies) {
        throw new BadRequestException(
          'Selected breed does not belong to the selected species',
        );
      }
    }
  
    try {
      const newUser = await this.prisma.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          interestedSpeciesId: interestedSpecies || null,
          interestedBreedId: interestedBreed || null,
        },
        include: {
          interestedSpecies: true,
          interestedBreed: true,
        },
      });
  
      const tokens = await this.createSessionAndTokens(newUser.id, newUser.role, ip, deviceInfo);
      const { password: _, ...result } = newUser;
      return { user:result, tokens };
    } catch (error) {
      console.log('Error while user registration', error);
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async login(payload: LoginDto, ip:string, deviceInfo:any) {
    const {email,password} = payload
    const user = await this.prisma.user.findUnique({
      where:{email},
    })
    if(!user) throw new UnauthorizedException("Invalid Credentials")
    
    const isPasswordValid = await bcrypt.compare(password , user.password)

    if(!isPasswordValid) throw new UnauthorizedException("Invalid Credentials")
    const tokens = await this.createSessionAndTokens(user.id, user.role, ip, deviceInfo);
   
    return{
      tokens,
      user : {
        id:user.id,
        name:user.name,
        email:user.email,
        role:user.role
      }
    }


  }
 

  async logout(sessionId?:string) {
    if(sessionId){
      await this.prisma.session.updateMany({
        where:{id:sessionId},
        data:{revokedAt:new Date()}
      })
    }
    return { message: 'Logged out successfully' };
  }
 
  async refreshToken(refreshToken:string){
    let payload: {userId:string,role:string,sessionId:string}
   try {
     payload = await this.jwtService.verifyAsync(refreshToken,{
      secret: process.env.JWT_REFRESH_SECRET || 'petnest_default_refresh_secret_key',
    })
   } catch (error) {
    throw new UnauthorizedException('Invalid refresh token')
   }

    const session = await this.prisma.session.findFirst({
      where:{
        id:payload.sessionId,
        revokedAt:null,
      }
    })
    if(!session) throw new UnauthorizedException('Session is invalid or has been revoked');

    if (session.expiresAt <= new Date()) {
  throw new UnauthorizedException('Session expired. Please log in again.');
}

    const isValid = await bcrypt.compare(refreshToken,session.hashToken)
    if(!isValid){
      await this.prisma.session.update({
        where:{id:session.id},
        data:{revokedAt:new Date()}
      })
    throw new UnauthorizedException('Invalid refresh token')
    }
    const newTokens = await this.rotateSessionTokens(session.id, session.userId, payload.role);
    return newTokens;
  }

  async forgotPassword(payload:ForgotPasswordDto){
    const user = await this.prisma.user.findUnique({
      where : {email:payload.email}
    });

    if(!user) {
      return {message:'A reset link has sent to your email'}
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    const tokenExpiry= new Date(Date.now() + 15 * 60 * 1000)

    await this.prisma.user.update({
      where: {id: user?.id},
      data:{
        resetPasswordToken:hashedToken,
        resetPasswordExpires:tokenExpiry,
      }
    })

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.FRONTENDURL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');

    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    return {
      message:`A reset link has been sent to ${payload?.email}`
    }
  }

  async resetPassword (payload:ResetPasswordDto){
    const {token,newPassword} = payload

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where:{resetPasswordToken:hashedToken,
        resetPasswordExpires:{gt:new Date()}
      }
    })

    if(!user) throw new BadRequestException('Invalid or expierd reset token')

    const hashedPassword = await bcrypt.hash(newPassword,this.saltRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where:{id:user?.id},
        data:{
          password:hashedPassword,
          resetPasswordToken:null,
          resetPasswordExpires:null,
        }
      }),

      this.prisma.session.deleteMany({where: {userId:user.id}})
    ])

    return {message:'Password has been reset Successfully. Please log in'}
  }

  private async createSessionAndTokens(userId: string, role: string, ip: string, deviceInfo: any) {
    const sessionId = randomUUID();
    const tokens = await this.generateTokens(userId, role, sessionId);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, this.saltRounds);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        hashToken: hashedRefreshToken,
        deviceInfo,
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      },
    });

    return tokens;
  }

  private async rotateSessionTokens(sessionId: string, userId: string, role: string) {
    const tokens = await this.generateTokens(userId, role, sessionId);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, this.saltRounds);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        hashToken: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  }

  private async generateTokens(userId:string,role:string,sessionId:string) {
    const payload = {userId,role,sessionId}

    const [accessToken, refreshToken] = await Promise.all([

      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'petnest_default_jwt_secret_key',
        expiresIn: '1h'
      }),

      this.jwtService.signAsync(payload,{
        secret: process.env.JWT_REFRESH_SECRET || 'petnest_default_refresh_secret_key',
        expiresIn: '7d'
            })
    ])
    return {accessToken,refreshToken}
  }
}

 