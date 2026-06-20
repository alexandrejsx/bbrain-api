import { User, UserGender } from '../../../../domain/users/entities/user.entity';
import { Email } from '../../../../domain/users/value-objects/email.vo';
import { UserName } from '../../../../domain/users/value-objects/user-name.vo';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import { UserDocument, UserMongo } from '../schemas/user.schema';

export class MongoUserMapper {
  static toPersistence(user: User): Partial<UserMongo> {
    return {
      _id: user.id.value,
      name: user.name.value,
      email: user.email.value,
      password_hash: user.passwordHash,
      birth_date: user.birthDate,
      gender: user.gender,
      phone: user.phone,
      timezone: user.timezone,
      accepted_terms_at: user.acceptedTermsAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_login_at: user.lastLoginAt
    };
  }

  static toDomain(raw: UserDocument | UserMongo): User {
    return User.create(
      {
        name: new UserName(raw.name),
        email: new Email(raw.email),
        passwordHash: raw.password_hash,
        birthDate: raw.birth_date,
        gender: raw.gender as UserGender | undefined,
        phone: raw.phone,
        timezone: raw.timezone,
        acceptedTermsAt: raw.accepted_terms_at,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        lastLoginAt: raw.last_login_at
      },
      new Uuid(raw._id)
    );
  }
}
