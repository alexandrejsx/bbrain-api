import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';
import { TagName } from '../value-objects/journal.value-objects';

export interface JournalTagProps {
  name: TagName;
  createdAt: Date;
}

export class JournalTag extends Entity<JournalTagProps> {
  private constructor(
    private readonly props: JournalTagProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: JournalTagProps, id?: Uuid): JournalTag {
    return new JournalTag(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      name: this.props.name.value,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
