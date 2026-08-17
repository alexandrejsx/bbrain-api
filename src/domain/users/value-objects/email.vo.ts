export class Email {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    this.value = normalized;

    if (!this.isValid(normalized)) {
      throw new Error('Invalid email');
    }
  }

  private isValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
