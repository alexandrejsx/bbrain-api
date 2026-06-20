import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('mongoDb.uri');
        const dbName = config.get<string>('mongoDb.dbName');

        if (!uri || !dbName) {
          throw new Error('Missing MongoDB configuration (uri or dbName)');
        }

        return {
          uri,
          dbName
        };
      },
      inject: [ConfigService]
    })
  ],
  exports: [MongooseModule]
})
export class MongodbModule {}
