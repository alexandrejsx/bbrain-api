import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import { CheckinRegisteredEvent } from '../events/check-in.events';
import {
  EnergyLevel,
  MoodLevel,
  MotivationLevel,
  SleepDuration,
  StressLevel
} from '../value-objects/check-in.value-objects';

interface BaseCheckinProps {
  userId: string;
  registeredAt: Date;
  notes?: string;
}

abstract class Checkin<TProps extends BaseCheckinProps> extends AggregateRoot<TProps> {
  protected constructor(
    protected readonly props: TProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  protected markRegistered(): void {
    this.addDomainEvent(new CheckinRegisteredEvent(this.id.value));
  }
}

export interface MoodCheckinProps extends BaseCheckinProps {
  mood: MoodLevel;
}

export class MoodCheckin extends Checkin<MoodCheckinProps> {
  static create(props: MoodCheckinProps, id?: Uuid): MoodCheckin {
    const checkin = new MoodCheckin(props, id);
    checkin.markRegistered();
    return checkin;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      mood: this.props.mood.value,
      registeredAt: this.props.registeredAt.toISOString(),
      notes: this.props.notes
    };
  }
}

export interface SleepCheckinProps extends BaseCheckinProps {
  duration: SleepDuration;
}

export class SleepCheckin extends Checkin<SleepCheckinProps> {
  static create(props: SleepCheckinProps, id?: Uuid): SleepCheckin {
    const checkin = new SleepCheckin(props, id);
    checkin.markRegistered();
    return checkin;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      duration: this.props.duration.value,
      registeredAt: this.props.registeredAt.toISOString(),
      notes: this.props.notes
    };
  }
}

export interface EnergyCheckinProps extends BaseCheckinProps {
  energy: EnergyLevel;
}

export class EnergyCheckin extends Checkin<EnergyCheckinProps> {
  static create(props: EnergyCheckinProps, id?: Uuid): EnergyCheckin {
    const checkin = new EnergyCheckin(props, id);
    checkin.markRegistered();
    return checkin;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      energy: this.props.energy.value,
      registeredAt: this.props.registeredAt.toISOString(),
      notes: this.props.notes
    };
  }
}

export interface StressCheckinProps extends BaseCheckinProps {
  stress: StressLevel;
}

export class StressCheckin extends Checkin<StressCheckinProps> {
  static create(props: StressCheckinProps, id?: Uuid): StressCheckin {
    const checkin = new StressCheckin(props, id);
    checkin.markRegistered();
    return checkin;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      stress: this.props.stress.value,
      registeredAt: this.props.registeredAt.toISOString(),
      notes: this.props.notes
    };
  }
}

export interface MotivationCheckinProps extends BaseCheckinProps {
  motivation: MotivationLevel;
}

export class MotivationCheckin extends Checkin<MotivationCheckinProps> {
  static create(props: MotivationCheckinProps, id?: Uuid): MotivationCheckin {
    const checkin = new MotivationCheckin(props, id);
    checkin.markRegistered();
    return checkin;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.props.userId,
      motivation: this.props.motivation.value,
      registeredAt: this.props.registeredAt.toISOString(),
      notes: this.props.notes
    };
  }
}
