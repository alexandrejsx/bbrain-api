import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WellbeingHistoryController } from '../controllers/wellbeing-history.controller';
import type { EventDispatcher } from '../domain/core/event-dispatcher';
import { UsageService } from '../domain/usage/services/usage.service';
import { WellbeingObservationRepository } from '../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import { WellbeingCandidateValidationPolicy } from '../domain/wellbeing-history/services/wellbeing-candidate-validation.policy';
import { UserRepository } from '../domain/users/repositories/user.repository';
import { GeminiObservationExtractor } from '../infrastructure/gemini/gemini-observation-extractor';
import { NoopObservationExtractor } from '../infrastructure/mock/noop-observation-extractor';
import { OpenAiObservationExtractor } from '../infrastructure/openai/openai-observation-extractor';
import { ObservationExtractorRouter } from '../infrastructure/wellbeing-history/observation-extractor-router';
import { ManageWellbeingHistoryService } from '../use-cases/wellbeing-history/manage-wellbeing-history.service';
import { CaptureWellbeingObservationsUseCase } from '../use-cases/wellbeing-history/capture-wellbeing-observations.use-case';
import { ObservationExtractor } from '../use-cases/wellbeing-history/ports/observation-extractor.port';
import { WellbeingObservationCaptureScheduler } from '../use-cases/wellbeing-history/wellbeing-observation-capture.scheduler';
import { DailyMoodSummaryProjectorService } from '../use-cases/wellbeing-history/daily-mood-summary-projector.service';
import { WellbeingCaptureCoordinator } from '../use-cases/wellbeing-history/wellbeing-capture-coordinator.service';
import { AuthModule } from './auth.module';
import { EventsModule } from './events.module';
import { PlansModule } from './plans.module';
import {
  EVENT_DISPATCHER,
  OBSERVATION_EXTRACTOR,
  SENSITIVE_TEXT_FINGERPRINT,
  USERS_REPOSITORY,
  WELLBEING_OBSERVATIONS_REPOSITORY
} from './tokens';
import { UsersModule } from './users.module';
import { WellbeingHistoryContextModule } from './wellbeing-history-context.module';
import { ConversationContextModule } from './conversation-context.module';
import { SensitiveTextFingerprintPort } from '../use-cases/conversation/ports/sensitive-text-fingerprint.port';

type ObservationProviderName = 'gemini' | 'openai' | 'noop';

@Module({
  imports: [
    AuthModule,
    ConversationContextModule,
    EventsModule,
    PlansModule,
    UsersModule,
    WellbeingHistoryContextModule
  ],
  controllers: [WellbeingHistoryController],
  providers: [
    GeminiObservationExtractor,
    OpenAiObservationExtractor,
    NoopObservationExtractor,
    {
      provide: DailyMoodSummaryProjectorService,
      useFactory: (repository: WellbeingObservationRepository, eventDispatcher: EventDispatcher) =>
        new DailyMoodSummaryProjectorService(repository, eventDispatcher),
      inject: [WELLBEING_OBSERVATIONS_REPOSITORY, EVENT_DISPATCHER]
    },
    {
      provide: OBSERVATION_EXTRACTOR,
      useFactory: (
        config: ConfigService,
        gemini: GeminiObservationExtractor,
        openAi: OpenAiObservationExtractor,
        noop: NoopObservationExtractor
      ): ObservationExtractor => {
        const enabled = config.get<boolean>('ai.observationExtraction.enabled') ?? false;
        const primaryName =
          config.get<ObservationProviderName>('ai.observationExtraction.primaryProvider') ??
          'gemini';
        const fallbackName =
          config.get<ObservationProviderName>('ai.observationExtraction.fallbackProvider') ??
          'noop';
        const providers: Record<ObservationProviderName, ObservationExtractor> = {
          gemini,
          openai: openAi,
          noop
        };

        if (!enabled) return noop;
        return new ObservationExtractorRouter(
          providers[primaryName],
          primaryName,
          providers[fallbackName],
          fallbackName
        );
      },
      inject: [
        ConfigService,
        GeminiObservationExtractor,
        OpenAiObservationExtractor,
        NoopObservationExtractor
      ]
    },
    {
      provide: WellbeingCandidateValidationPolicy,
      useFactory: (config: ConfigService) =>
        new WellbeingCandidateValidationPolicy(
          config.get<number>('ai.observationExtraction.minimumConfidence') ?? 0.85
        ),
      inject: [ConfigService]
    },
    {
      provide: CaptureWellbeingObservationsUseCase,
      useFactory: (
        config: ConfigService,
        extractor: ObservationExtractor,
        validationPolicy: WellbeingCandidateValidationPolicy,
        repository: WellbeingObservationRepository,
        userRepository: UserRepository,
        usageService: UsageService,
        eventDispatcher: EventDispatcher,
        moodProjector: DailyMoodSummaryProjectorService,
        fingerprintService: SensitiveTextFingerprintPort
      ) =>
        new CaptureWellbeingObservationsUseCase(
          extractor,
          validationPolicy,
          repository,
          userRepository,
          usageService,
          eventDispatcher,
          moodProjector,
          fingerprintService,
          config.get<boolean>('ai.observationExtraction.persistEnabled') ?? false
        ),
      inject: [
        ConfigService,
        OBSERVATION_EXTRACTOR,
        WellbeingCandidateValidationPolicy,
        WELLBEING_OBSERVATIONS_REPOSITORY,
        USERS_REPOSITORY,
        UsageService,
        EVENT_DISPATCHER,
        DailyMoodSummaryProjectorService,
        SENSITIVE_TEXT_FINGERPRINT
      ]
    },
    {
      provide: WellbeingObservationCaptureScheduler,
      useFactory: (
        config: ConfigService,
        capture: CaptureWellbeingObservationsUseCase,
        coordinator: WellbeingCaptureCoordinator
      ) =>
        new WellbeingObservationCaptureScheduler(
          config.get<boolean>('ai.observationExtraction.enabled') ?? false,
          capture,
          coordinator
        ),
      inject: [ConfigService, CaptureWellbeingObservationsUseCase, WellbeingCaptureCoordinator]
    },
    {
      provide: ManageWellbeingHistoryService,
      useFactory: (
        repository: WellbeingObservationRepository,
        userRepository: UserRepository,
        eventDispatcher: EventDispatcher,
        moodProjector: DailyMoodSummaryProjectorService
      ) =>
        new ManageWellbeingHistoryService(
          repository,
          userRepository,
          eventDispatcher,
          moodProjector
        ),
      inject: [
        WELLBEING_OBSERVATIONS_REPOSITORY,
        USERS_REPOSITORY,
        EVENT_DISPATCHER,
        DailyMoodSummaryProjectorService
      ]
    }
  ],
  exports: [WellbeingObservationCaptureScheduler, ManageWellbeingHistoryService]
})
export class WellbeingHistoryModule {}
