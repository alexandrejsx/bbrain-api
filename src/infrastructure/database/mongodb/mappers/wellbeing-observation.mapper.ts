import { Uuid } from '../../../../domain/shared/uuid.vo';
import { WellbeingObservation } from '../../../../domain/wellbeing-history/entities/wellbeing-observation.entity';
import { WellbeingObservationProps } from '../../../../domain/wellbeing-history/value-objects/wellbeing-observation.types';
import { WellbeingObservationMongo } from '../schemas/wellbeing-observation.schema';

const toSnakeCase = (key: string): string =>
  key.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);

const toCamelCase = (key: string): string =>
  key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());

function mapKeys(value: unknown, mapKey: (key: string) => string): unknown {
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map((entry) => mapKeys(entry, mapKey));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [mapKey(key), mapKeys(nestedValue, mapKey)])
  );
}

function redactLegacyEvidenceQuote(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLegacyEvidenceQuote);
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const mapped = Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => key !== 'evidenceQuote')
      .map(([key, nested]) => [key, redactLegacyEvidenceQuote(nested)])
  );
  if (typeof record.evidenceQuote === 'string' && !mapped.evidenceFingerprint) {
    mapped.evidenceFingerprint = createHash('sha256')
      .update(`legacy:${record.evidenceQuote}`, 'utf8')
      .digest('hex');
  }
  return mapped;
}

export class MongoWellbeingObservationMapper {
  static toPersistence(observation: WellbeingObservation): WellbeingObservationMongo {
    return {
      _id: observation.id.value,
      user_id: observation.userId,
      idempotency_key: observation.idempotencyKey,
      kind: observation.kind,
      data: mapKeys(observation.data, toSnakeCase) as Record<string, unknown>,
      temporal_reference: mapKeys(observation.temporalReference, toSnakeCase) as Record<
        string,
        unknown
      >,
      provenance_history: mapKeys(observation.provenanceHistory, toSnakeCase) as Record<
        string,
        unknown
      >[],
      revision_history: mapKeys(observation.revisionHistory, toSnakeCase) as Record<
        string,
        unknown
      >[],
      revision: observation.revision,
      created_at: observation.createdAt,
      updated_at: observation.updatedAt
    };
  }

  static toDomain(raw: WellbeingObservationMongo): WellbeingObservation {
    const kind = raw.kind;
    const props = {
      userId: raw.user_id,
      idempotencyKey: raw.idempotency_key,
      kind,
      data: mapKeys(raw.data, toCamelCase),
      temporalReference: mapKeys(raw.temporal_reference, toCamelCase),
      provenanceHistory: redactLegacyEvidenceQuote(mapKeys(raw.provenance_history, toCamelCase)),
      revisionHistory: redactLegacyEvidenceQuote(mapKeys(raw.revision_history ?? [], toCamelCase)),
      revision: raw.revision,
      createdAt: new Date(raw.created_at),
      updatedAt: new Date(raw.updated_at)
    } as WellbeingObservationProps;

    return WellbeingObservation.reconstitute(props, new Uuid(raw._id));
  }
}
import { createHash } from 'node:crypto';
