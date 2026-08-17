import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SleepMongo, SleepSchema } from './sleep.schema';
import { SleepRepository } from './sleep.repository';
import { SleepService } from './sleep.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: SleepMongo.name, schema: SleepSchema }])],
  providers: [SleepRepository, SleepService],
  exports: [SleepRepository, SleepService]
})
export class SleepModule {}
