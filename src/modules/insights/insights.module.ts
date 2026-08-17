import { Module } from '@nestjs/common';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { AuthModule } from '../auth/auth.module';
import { USERS_REPOSITORY } from '../tokens';
import { UsersModule } from '../users/users.module';
import { InsightsController } from './insights.controller';
import { ListInsightsService } from './list-insights.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [InsightsController],
  providers: [
    {
      provide: ListInsightsService,
      useFactory: (userRepository: UserRepository) => new ListInsightsService(userRepository),
      inject: [USERS_REPOSITORY]
    }
  ]
})
export class InsightsModule {}
