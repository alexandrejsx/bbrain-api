import isEqual from 'lodash/isEqual';

export abstract class ValueObject<Value = any> {
  protected readonly _value: Value;

  constructor(value: Value) {
    this._value = value;
  }

  get value(): Value {
    return this._value;
  }

  equals(obj: this): boolean {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (obj.value === undefined) {
      return false;
    }

    if (obj.constructor.name !== this.constructor.name) {
      return false;
    }

    return isEqual(this.value, obj.value);
  }

  toString = () => {
    const val = this.value;

    if (val === null || val === undefined) {
      return '';
    }

    if (typeof val === 'object') {
      const customToString =
        Object.prototype.toString.call(val) !== '[object Object]' ||
        val.toString !== Object.prototype.toString;

      return customToString ? val.toString() : JSON.stringify(val);
    }

    return String(val);
  };
}
