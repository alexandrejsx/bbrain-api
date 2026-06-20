import { ValueObject } from '../../core/value-object';

export class Email extends ValueObject<string> {
  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    super(normalized);

    if (!this.isValid(normalized)) {
      throw new Error('Invalid email');
    }
  }

  private isValid(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
