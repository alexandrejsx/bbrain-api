import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MoodMongo, MoodSchema } from './mood.schema';
import { MoodRepository } from './mood.repository';
import { MoodService } from './mood.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: MoodMongo.name, schema: MoodSchema }])],
  providers: [MoodRepository, MoodService],
  exports: [MoodRepository, MoodService]
})
export class MoodModule {}
