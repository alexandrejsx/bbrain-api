export interface CheckinValidationService {
  assertCanRegister(userId: string, registeredAt: Date): void;
}
