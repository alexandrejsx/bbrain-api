import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export interface MemoryReferenceProps {
  memoryId: string;
  sourceId: string;
  sourceType: string;
  createdAt: Date;
}

export class MemoryReference extends Entity<MemoryReferenceProps> {
  private constructor(
    private readonly props: MemoryReferenceProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: MemoryReferenceProps, id?: Uuid): MemoryReference {
    return new MemoryReference(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      memoryId: this.props.memoryId,
      sourceId: this.props.sourceId,
      sourceType: this.props.sourceType,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}
