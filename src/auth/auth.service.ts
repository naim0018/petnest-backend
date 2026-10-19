import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
@Injectable()
export class AuthService {
  constructor (private readonly prisma:PrismaService, private readonly jwtService:JwtService) {}
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
  async register(payload:RegisterDto,ip:string,deviceInfo:any){ 
    const {name,email,password,phone,interestedBreed,interestedSpecies} = payload;

    const existingUser = await this.prisma.user.findUnique({
      where: {email}
    })

    if (existingUser) throw new ConflictException("User already exists")

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    if (interestedSpecies) {
      const speciesExists = await this.prisma.petSpecies.findUnique({
        where: { id: interestedSpecies },
      });
      if (!speciesExists) {
        throw new ConflictException('Selected interested species does not exist');
      }
    }

    if (interestedBreed) {
      const breedExists = await this.prisma.petBreed.findUnique({
        where: { id: interestedBreed },
      });
      if (!breedExists) {
        throw new ConflictException('Selected interested breed does not exist');
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
  async refreshToken(refreshToken:string){
    let payload: {userId:string,role:string,sessionId:string}
   try {
     payload = await this.jwtService.verifyAsync(refreshToken,{
      secret:process.env.JWT_REFRESH_SECRET,
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

  private async createSessionAndTokens(userId: string, role: string, ip: string, deviceInfo: any) {
    const sessionId = randomUUID();
    const tokens = await this.generateTokens(userId, role, sessionId);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

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
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

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
        secret:process.env.JWT_SECRET,
        expiresIn: 10*60*60*1000
      }),

      this.jwtService.signAsync(payload,{
        secret:process.env.JWT_REFRESH_SECRET,
        expiresIn: 7*24*60*60*1000
      })
    ])
    return {accessToken,refreshToken}
  }
}

 