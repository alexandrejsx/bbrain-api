import { Injectable } from '@nestjs/common';
import { ReflectiveProfile } from '../../../../domain/conversation/entities/reflective-profile.entity';
import { ReflectiveProfileRepository } from '../../../../domain/conversation/repositories/reflective-profile.repository';
import { MongoReflectiveProfileMapper } from '../mappers/reflective-profile.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { ReflectiveProfileDocument } from '../schemas/reflective-profile.schema';

@Injectable()
export class MongoReflectiveProfileRepository implements ReflectiveProfileRepository {
  constructor(private readonly baseRepository: MongodbRepository<ReflectiveProfileDocument>) {}

  async findByUserId(userId: string): Promise<ReflectiveProfile | null> {
    const doc = await this.baseRepository.findOne({ user_id: userId });
    return doc ? MongoReflectiveProfileMapper.toDomain(doc) : null;
  }

  async save(profile: ReflectiveProfile): Promise<void> {
    const persistence = MongoReflectiveProfileMapper.toPersistence(profile);
    const existing = await this.baseRepository.findOne({ user_id: profile.toJson().userId });

    if (existing) {
      await this.baseRepository.update(existing._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
