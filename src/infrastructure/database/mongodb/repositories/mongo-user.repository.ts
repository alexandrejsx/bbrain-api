import { Injectable } from '@nestjs/common';
import { User } from '../../../../domain/users/entities/user.entity';
import { UserRepository } from '../../../../domain/users/repositories/user.repository';
import { MongoUserMapper } from '../mappers/user.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { UserDocument } from '../schemas/user.schema';

@Injectable()
export class MongoUserRepository implements UserRepository {
  constructor(private readonly baseRepository: MongodbRepository<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.baseRepository.findOne(id);
    return doc ? MongoUserMapper.toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const doc = await this.baseRepository.findOne({
      email: normalizedEmail
    });

    return doc ? MongoUserMapper.toDomain(doc) : null;
  }

  async save(user: User): Promise<void> {
    const persistence = MongoUserMapper.toPersistence(user);

    if (!persistence._id) {
      throw new Error('Cannot persist user without id');
    }

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
