import { ValueObject } from '../../core/value-object';

export class Password extends ValueObject<string> {
  constructor(value: string) {
    super(value);

    if (value.length < 8) {
      throw new Error('Password must have at least 8 characters');
    }
  }
}
