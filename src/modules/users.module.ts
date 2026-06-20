import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongodbRepository } from '../infrastructure/database/mongodb/mongodb.repository';
import { MongoUserRepository } from '../infrastructure/database/mongodb/repositories/mongo-user.repository';
import {
  UserDocument,
  UserMongo,
  UserSchema
} from '../infrastructure/database/mongodb/schemas/user.schema';
import { USERS_BASE_REPOSITORY, USERS_REPOSITORY } from './tokens';

@Module({
  imports: [MongooseModule.forFeature([{ name: UserMongo.name, schema: UserSchema }])],
  providers: [
    {
      provide: USERS_BASE_REPOSITORY,
      useFactory: (model: Model<UserDocument>) => {
        return new MongodbRepository<UserDocument>(model);
      },
      inject: [getModelToken(UserMongo.name)]
    },
    {
      provide: USERS_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<UserDocument>) => {
        return new MongoUserRepository(baseRepository);
      },
      inject: [USERS_BASE_REPOSITORY]
    }
  ],
  exports: [USERS_REPOSITORY]
})
export class UsersModule {}
