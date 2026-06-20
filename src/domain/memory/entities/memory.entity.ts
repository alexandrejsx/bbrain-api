import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { MemoryCreatedEvent } from '../events/memory.events';
import {
  ConfidenceLevel,
  MemoryCategory,
  MemoryContent,
  MemorySource,
  RelevanceScore,
  RetentionPolicy
} from '../value-objects/memory.value-objects';

export interface MemoryProps {
  userId: string;
  category: MemoryCategory;
  content: MemoryContent;
  confidence: ConfidenceLevel;
  source: MemorySource;
  relevance: RelevanceScore;
  retentionPolicy: RetentionPolicy;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export class Memory extends AggregateRoot<MemoryProps> {
  private constructor(
    private readonly props: MemoryProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: MemoryProps, id?: Uuid): Memory {
    const memory = new Memory(props, id);
    memory.addDomainEvent(new MemoryCreatedEvent(memory.id.value));
    return memory;
  }

  static reconstitute(props: MemoryProps, id: Uuid): Memory {
    return new Memory(props, id);
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      category: this.props.category.value,
      content: this.props.content.value,
      confidence: this.props.confidence.value,
      source: this.props.source.value,
      relevance: this.props.relevance.value,
      retentionPolicy: this.props.retentionPolicy.value,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      archivedAt: this.props.archivedAt?.toISOString()
    };
  }
}
