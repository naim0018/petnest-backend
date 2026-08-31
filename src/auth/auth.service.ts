import { Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  login(dto: LoginDto) {
    const user = this.prisma.user()
    return { message: 'Logged in successfully', email: dto.email };
  }
  logout() {
    return { message: 'Logged out successfully' };
  }
  register(){ 
    return { message:'User Register Successfully', }
  }
}
 