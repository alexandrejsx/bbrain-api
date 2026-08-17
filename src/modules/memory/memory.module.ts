import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CurrentContextMongo,
  CurrentContextSchema,
  MemoryMongo,
  MemorySchema
} from './memory.schema';
import { CurrentContextRepository, MemoryRepository } from './memory.repository';
import { MemoryService } from './memory.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemoryMongo.name, schema: MemorySchema },
      { name: CurrentContextMongo.name, schema: CurrentContextSchema }
    ])
  ],
  providers: [MemoryRepository, CurrentContextRepository, MemoryService],
  exports: [MemoryRepository, CurrentContextRepository, MemoryService]
})
export class MemoryModule {}
