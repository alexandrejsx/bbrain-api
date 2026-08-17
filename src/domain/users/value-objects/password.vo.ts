export class Password {
  readonly value: string;

  constructor(value: string) {
    this.value = value;

    if (value.length < 8) {
      throw new Error('Password must have at least 8 characters');
    }
  }
}
