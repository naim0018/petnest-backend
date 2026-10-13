import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
  constructor (private readonly prisma:PrismaService, private readonly jwtService:JwtService) {}
  async login(payload: LoginDto) {
    const {email,password} = payload
    const user = await this.prisma.user.findUnique({
      where:{email},
    })
    if(!user) throw new UnauthorizedException("Invalid Credentials")
    
    const isPasswordValid = await bcrypt.compare(password , user.password)

    if(!isPasswordValid) throw new UnauthorizedException("Invalid Credentials")

    const tokens = await this.generateTokens(user.id,user.role)

    return{
      token:tokens,
      user : {
        id:user.id,
        name:user.name,
        email:user.email,
        role:user.role
      }
    }


  }
  logout() {
    return { message: 'Logged out successfully' };
  }
  async register(payload:RegisterDto){ 
    console.log(payload);

    const {name,email,password,phone,interestedBreed,interestedSpecies} = payload;

    const existingUser = await this.prisma.user.findUnique({
      where: {email}
    })

    console.log(existingUser)

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
      const { password: _, ...result } = newUser;
      return { message: 'User Register Successfully', data: result };
    } catch (error) {
      console.log('Error while user registration', error);
      throw new InternalServerErrorException('Failed to register user');
    }
  }
  
  private async generateTokens(userId:string,role:string) {
    const payload = {userId,role}

    const [accessToken, refreshToken] = await Promise.all([

      this.jwtService.signAsync(payload, {
        secret:process.env.JWT_SECRET,
        expiresIn:'1h'
      }),

      this.jwtService.signAsync(payload,{
        secret:process.env.JWT_REFRESH_SECRET,
        expiresIn:'1w'
      })
    ])
    return {accessToken,refreshToken}
  }
}

 