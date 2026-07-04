import { Module } from '@nestjs/common';
import { EventDispatcherAdapter } from '../infrastructure/events/event-dispatcher.adapter';
import { EVENT_DISPATCHER } from './tokens';

@Module({
  providers: [
    EventDispatcherAdapter,
    {
      provide: EVENT_DISPATCHER,
      useExisting: EventDispatcherAdapter
    }
  ],
  exports: [EventDispatcherAdapter, EVENT_DISPATCHER]
})
export class EventsModule {}
