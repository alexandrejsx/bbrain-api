import { ReflectiveProfile } from '../../../../domain/conversation/entities/reflective-profile.entity';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import {
  ReflectiveProfileDocument,
  ReflectiveProfileMongo
} from '../schemas/reflective-profile.schema';

export class MongoReflectiveProfileMapper {
  static toPersistence(profile: ReflectiveProfile): Partial<ReflectiveProfileMongo> {
    const raw = profile.toJson();

    return {
      _id: raw.id,
      user_id: raw.userId,
      preferred_tone: raw.preferredTone,
      analysis_goals: raw.analysisGoals,
      recurring_themes: raw.recurringThemes,
      emotional_patterns: raw.emotionalPatterns,
      routine_notes: raw.routineNotes,
      helpful_strategies: raw.helpfulStrategies,
      unhelpful_strategies: raw.unhelpfulStrategies,
      boundaries: raw.boundaries,
      reported_formal_diagnoses: raw.reportedFormalDiagnoses,
      reported_medication: raw.reportedMedication,
      professional_support: raw.professionalSupport,
      current_context_summary: raw.currentContextSummary,
      last_interaction_at: raw.lastInteractionAt ? new Date(raw.lastInteractionAt) : undefined,
      created_at: new Date(raw.createdAt),
      updated_at: new Date(raw.updatedAt)
    };
  }

  static toDomain(raw: ReflectiveProfileDocument | ReflectiveProfileMongo): ReflectiveProfile {
    return ReflectiveProfile.reconstitute(
      {
        userId: raw.user_id,
        preferredTone: raw.preferred_tone,
        analysisGoals: [...(raw.analysis_goals ?? [])],
        recurringThemes: [...raw.recurring_themes],
        emotionalPatterns: [...raw.emotional_patterns],
        routineNotes: [...raw.routine_notes],
        helpfulStrategies: [...raw.helpful_strategies],
        unhelpfulStrategies: [...raw.unhelpful_strategies],
        boundaries: [...raw.boundaries],
        reportedFormalDiagnoses: [...(raw.reported_formal_diagnoses ?? [])],
        reportedMedication: raw.reported_medication,
        professionalSupport: raw.professional_support,
        currentContextSummary: raw.current_context_summary,
        lastInteractionAt: raw.last_interaction_at,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      },
      new Uuid(raw._id)
    );
  }
}
