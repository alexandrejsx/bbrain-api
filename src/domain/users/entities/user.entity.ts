import { AggregateRoot } from '../../core/aggregate-root';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import type { UserProfileSnapshot } from './user-profile.types';
import { Email } from '../value-objects/email.vo';
import { UserName } from '../value-objects/user-name.vo';
import { Uuid } from '../../shared/uuid.vo';

export interface UserProps {
  name: UserName;
  email: Email;
  passwordHash: string;
  phone?: string;
  timezone: string;
  acceptedTermsAt: Date;
  profile?: UserProfileSnapshot;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(
    private readonly props: UserProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: UserProps, id?: Uuid): User {
    return new User(props, id);
  }

  static register(
    props: Omit<UserProps, 'createdAt' | 'updatedAt' | 'timezone'> & {
      timezone?: string;
      createdAt?: Date;
      updatedAt?: Date;
    },
    id?: Uuid
  ): User {
    const now = new Date();
    const user = new User(
      {
        ...props,
        timezone: props.timezone ?? 'America/Sao_Paulo',
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now
      },
      id
    );

    user.addDomainEvent(new UserCreatedEvent(user.id.value));

    return user;
  }

  markLoggedIn(date = new Date()): void {
    this.props.lastLoginAt = date;
    this.props.updatedAt = date;
    this.addDomainEvent(new UserLoggedInEvent(this.id.value));
  }

  updateBasicInfo(
    input: {
      name: string;
      timezone?: string;
    },
    date = new Date()
  ): void {
    this.props.name = new UserName(input.name);
    this.props.timezone = input.timezone ?? this.props.timezone;
    this.props.updatedAt = date;
  }

  updateProfile(profile: UserProfileSnapshot, date = new Date()): void {
    this.props.profile = profile;
    this.props.updatedAt = date;
  }

  get name(): UserName {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get acceptedTermsAt(): Date {
    return this.props.acceptedTermsAt;
  }

  get profile(): UserProfileSnapshot | undefined {
    return this.props.profile;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  toJson() {
    return {
      id: this.id.value,
      name: this.name.value,
      email: this.email.value,
      phone: this.phone,
      timezone: this.timezone,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastLoginAt: this.lastLoginAt?.toISOString()
    };
  }
}
