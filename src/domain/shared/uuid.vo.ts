import { randomUUID } from 'crypto';
import { ValueObject } from '../core/value-object';

export class Uuid extends ValueObject<string> {
  constructor(value?: string) {
    super(value ?? randomUUID());

    if (!this.isValid(this.value)) {
      throw new Error('Invalid UUID');
    }
  }

  private isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  static create(): Uuid {
    return new Uuid();
  }
}
