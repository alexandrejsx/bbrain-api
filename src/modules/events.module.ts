import { Module } from '@nestjs/common';
import { EventDispatcherAdapter } from '../domain/events/event-dispatcher.adapter';

@Module({
  providers: [EventDispatcherAdapter],
  exports: [EventDispatcherAdapter]
})
export class EventsModule {}
