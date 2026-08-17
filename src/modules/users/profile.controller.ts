import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedRequest,
  JwtAuthGuard
} from '../../infrastructure/http/guards/jwt-auth.guard';
import { UpdateUserProfileDto } from './profile.dto';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly updateUserProfileUseCase: UpdateUserProfileUseCase) {}

  @Put()
  async update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateUserProfileDto) {
    const birthDate = dto.basicInfo.birthDate
      ? new Date(
          dto.basicInfo.birthDate.includes('T')
            ? dto.basicInfo.birthDate
            : `${dto.basicInfo.birthDate}T00:00:00.000Z`
        )
      : undefined;

    return this.updateUserProfileUseCase.execute({
      userId: request.user!.id,
      phone: dto.phone,
      plan: dto.plan,
      profile: {
        profileCompleted: dto.profileCompleted,
        basicInfo: {
          ...dto.basicInfo,
          birthDate
        },
        goals: dto.goals,
        conversationPreferences: dto.conversationPreferences,
        professionalContext: dto.professionalContext,
        privacySettings: dto.privacySettings
      }
    });
  }
}
