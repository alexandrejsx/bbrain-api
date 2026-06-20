import { Uuid } from '../shared/uuid.vo';

export abstract class Entity<T> {
  id: Uuid;

  abstract toJson(): any;

  equals(obj: Entity<T>) {
    if (obj === null || obj === undefined) {
      return false;
    }

    if (obj.id === undefined) {
      return false;
    }

    return obj.id.equals(this.id);
  }
}
