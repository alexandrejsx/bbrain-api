import { randomUUID } from 'crypto';
export class Uuid {
  readonly value: string;

  constructor(value?: string) {
    this.value = value ?? randomUUID();

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
