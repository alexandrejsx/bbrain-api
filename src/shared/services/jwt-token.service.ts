import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../domain/users/entities/user.entity';

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signUser(user: User): Promise<string> {
    return this.jwtService.signAsync({
      sub: user.id.value
    });
  }
}
