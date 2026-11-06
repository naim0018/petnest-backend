import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports:[
    JwtModule.register({
      global:true,
      secret: process.env.JWT_SECRET || 'petnest_default_jwt_secret_key',
      signOptions:{expiresIn:'1h'}
    })
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
