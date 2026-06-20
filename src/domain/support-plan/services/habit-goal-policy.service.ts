export interface HabitGoalPolicyService {
  assertCanAddGoal(userId: string, description: string): void;
}
