import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenExpiredError } from 'jsonwebtoken';
import { UserRepository } from '../../../domain/users/repositories/user.repository';
import { USERS_REPOSITORY } from '../../../modules/tokens';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
  };
}

interface JwtPayload {
  sub?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(USERS_REPOSITORY) private readonly userRepository: UserRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const [scheme, token] = header?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = {
        id: payload.sub
      };

      const user = await this.userRepository.findById(payload.sub);

      if (!user || user.hasScheduledDeletion()) {
        throw new UnauthorizedException('Account is unavailable');
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          message: 'Access token expired',
          code: 'ACCESS_TOKEN_EXPIRED'
        });
      }

      throw new UnauthorizedException({
        message: 'Invalid access token',
        code: 'INVALID_ACCESS_TOKEN'
      });
    }
  }
}
