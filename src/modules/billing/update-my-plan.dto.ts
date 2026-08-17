import { IsEnum } from 'class-validator';
import { PlanType } from '../../domain/plans/plan-definition';

export class UpdateMyPlanDto {
  @IsEnum(PlanType)
  plan: PlanType;
}
