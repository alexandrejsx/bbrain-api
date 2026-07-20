import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoWellbeingObservationRepository } from '../infrastructure/database/mongodb/repositories/mongo-wellbeing-observation.repository';
import {
  WellbeingObservationDocument,
  WellbeingObservationMongo,
  WellbeingObservationSchema
} from '../infrastructure/database/mongodb/schemas/wellbeing-observation.schema';
import { WELLBEING_OBSERVATIONS_REPOSITORY } from './tokens';
import { WellbeingCaptureCoordinator } from '../use-cases/wellbeing-history/wellbeing-capture-coordinator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WellbeingObservationMongo.name, schema: WellbeingObservationSchema }
    ])
  ],
  providers: [
    WellbeingCaptureCoordinator,
    {
      provide: WELLBEING_OBSERVATIONS_REPOSITORY,
      useFactory: (model: Model<WellbeingObservationDocument>) =>
        new MongoWellbeingObservationRepository(model),
      inject: [getModelToken(WellbeingObservationMongo.name)]
    }
  ],
  exports: [WELLBEING_OBSERVATIONS_REPOSITORY, WellbeingCaptureCoordinator]
})
export class WellbeingHistoryContextModule {}
