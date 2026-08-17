export class UserName {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim();
    this.value = normalized;

    if (normalized.length < 2) {
      throw new Error('User name must have at least 2 characters');
    }
  }
}
