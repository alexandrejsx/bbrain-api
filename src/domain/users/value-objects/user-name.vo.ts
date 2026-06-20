import { ValueObject } from '../../core/value-object';

export class UserName extends ValueObject<string> {
  constructor(value: string) {
    const normalized = value.trim();
    super(normalized);

    if (normalized.length < 2) {
      throw new Error('User name must have at least 2 characters');
    }
  }
}
