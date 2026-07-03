import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlanDefinition, PlanType, PublicPlanDefinition } from '../../domain/plans/plan-definition';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import type { PublicUser } from '../auth/auth-response';
import { PlansService } from './plans.service';

export interface CurrentPlanOutput {
  plan: PlanType;
  planName: string;
  definition: PlanDefinition;
}

export interface UpdatePlanOutput {
  user: PublicUser;
  plan: PlanType;
  planName: string;
  definition: PlanDefinition;
}

export class AccountPlanService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly plansService: PlansService
  ) {}

  listPlans(): PublicPlanDefinition[] {
    return this.plansService.getPublicPlans();
  }

  async getCurrentPlan(userId: string): Promise<CurrentPlanOutput> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const definition = this.plansService.getPlanDefinition(user.plan);

    return {
      plan: user.plan,
      planName: definition.name,
      definition
    };
  }

  async updatePlan(userId: string, plan: PlanType): Promise<UpdatePlanOutput> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (plan !== PlanType.FREE) {
      throw new BadRequestException('Planos pagos devem ser ativados pelo checkout.');
    }

    if (user.getEffectivePlan() !== PlanType.FREE) {
      throw new BadRequestException(
        'Seu plano atual continuará ativo até o fim do período pago. Para mudar para um plano inferior, aguarde o fim do ciclo atual.'
      );
    }

    const definition = this.plansService.getPlanDefinition(plan);

    // TODO: substituir esta atualização direta por validação de pagamento/checkout.
    user.updatePlan(plan);
    await this.userRepository.save(user);

    return {
      user: user.toJson(),
      plan,
      planName: definition.name,
      definition
    };
  }
}
