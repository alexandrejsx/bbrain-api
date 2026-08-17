import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyCheckInRepository } from './daily-check-in.repository';
import { DailyCheckInMongo, DailyCheckInSchema } from './daily-check-in.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DailyCheckInMongo.name, schema: DailyCheckInSchema }])
  ],
  providers: [DailyCheckInRepository],
  exports: [DailyCheckInRepository]
})
export class DailyCheckInStorageModule {}
