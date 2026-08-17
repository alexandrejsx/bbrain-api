export type WellbeingKind = 'mood_event' | 'mood_daily_summary' | 'sleep_record';
export type Precision = 'exact' | 'approximate';

export type TemporalReference =
  | { kind: 'moment'; at: string; timezone: string; precision: Precision }
  | { kind: 'specific_day'; localDate: string; timezone: string; precision: Precision }
  | { kind: 'specific_night'; localDate: string; timezone: string; precision: Precision }
  | {
      kind: 'interval';
      startsAt: string;
      endsAt: string;
      timezone: string;
      precision: Precision;
    }
  | {
      kind: 'period';
      startsOn?: string;
      endsOn?: string;
      descriptor?: string;
      timezone: string;
      precision: Precision;
    }
  | { kind: 'unknown'; timezone: string };

export type WellbeingProvenance =
  | { source: 'manual' }
  | { source: 'manual_correction'; correctedAt: string }
  | {
      source: 'guided_checkin';
      checkInId: string;
      localDate: string;
      confidenceByField: Record<string, number>;
    };

export interface WellbeingRecord {
  id: string;
  userId: string;
  kind: WellbeingKind;
  data: Record<string, unknown>;
  temporalReference: TemporalReference;
  provenance: WellbeingProvenance;
  provenanceHistory: WellbeingProvenance[];
  revision: number;
  clientRequestId?: string;
  sessionId?: string;
  sourceEventId?: string;
  capturedAt: Date;
  extractorVersion?: string;
  promptVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicWellbeingRecord(record: WellbeingRecord) {
  return {
    id: record.id,
    kind: record.kind,
    data: record.data,
    temporalReference: record.temporalReference,
    provenance: record.provenance,
    provenanceHistory: record.provenanceHistory,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class WellbeingNotFoundError extends Error {}
export class WellbeingRevisionConflictError extends Error {}
export class WellbeingIdempotencyConflictError extends Error {}
export class InvalidWellbeingRecordError extends Error {}
