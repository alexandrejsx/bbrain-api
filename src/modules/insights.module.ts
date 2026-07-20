import { Module } from '@nestjs/common';
import { InsightsController } from '../controllers/insights.controller';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { ListInsightsService } from '../use-cases/insights/list-insights.service';
import { AuthModule } from './auth.module';
import { USERS_REPOSITORY } from './tokens';
import { UsersModule } from './users.module';

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
