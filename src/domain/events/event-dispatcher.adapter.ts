import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../core/domain-event';
import { EventDispatcher } from '../core/event-dispatcher';

@Injectable()
export class EventDispatcherAdapter implements EventDispatcher {
  constructor(private readonly emitter: EventEmitter2) {}

  async dispatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.emitter.emitAsync(event.name, event);
    }
  }
}
