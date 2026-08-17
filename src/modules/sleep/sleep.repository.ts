import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { isEqual } from 'lodash';
import { Model } from 'mongoose';
import { SleepDocument, SleepMongo } from './sleep.schema';
import {
  WellbeingIdempotencyConflictError,
  WellbeingRecord,
  WellbeingRevisionConflictError
} from '../wellbeing/wellbeing.types';

function toRecord(document: SleepDocument): WellbeingRecord {
  return {
    id: document._id,
    userId: document.user_id,
    kind: 'sleep_record',
    data: document.data,
    temporalReference: document.temporal_reference as WellbeingRecord['temporalReference'],
    provenance: document.provenance as WellbeingRecord['provenance'],
    provenanceHistory: document.provenance_history as WellbeingRecord['provenanceHistory'],
    revision: document.revision,
    clientRequestId: document.client_request_id,
    sessionId: document.session_id,
    sourceEventId: document.source_event_id,
    capturedAt: document.captured_at,
    extractorVersion: document.extractor_version,
    promptVersion: document.prompt_version,
    createdAt: document.created_at,
    updatedAt: document.updated_at
  };
}

@Injectable()
export class SleepRepository {
  constructor(@InjectModel(SleepMongo.name) private readonly model: Model<SleepDocument>) {}

  async list(userId: string): Promise<WellbeingRecord[]> {
    return (
      await this.model
        .find({ user_id: userId })
        .sort({ 'temporal_reference.localDate': -1, captured_at: -1 })
        .exec()
    ).map(toRecord);
  }

  async findById(userId: string, id: string): Promise<WellbeingRecord | null> {
    const document = await this.model.findOne({ _id: id, user_id: userId }).exec();
    return document ? toRecord(document) : null;
  }

  async findBySourceEventId(
    userId: string,
    sourceEventId: string
  ): Promise<WellbeingRecord | null> {
    const document = await this.model
      .findOne({ user_id: userId, source_event_id: sourceEventId })
      .exec();
    return document ? toRecord(document) : null;
  }

  async create(
    input: Omit<WellbeingRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WellbeingRecord | null> {
    try {
      const document = await this.model.create({
        _id: randomUUID(),
        user_id: input.userId,
        data: input.data,
        temporal_reference: input.temporalReference,
        provenance: input.provenance,
        provenance_history: input.provenanceHistory,
        revision: input.revision,
        client_request_id: input.clientRequestId,
        session_id: input.sessionId,
        source_event_id: input.sourceEventId,
        captured_at: input.capturedAt,
        extractor_version: input.extractorVersion,
        prompt_version: input.promptVersion
      });
      return toRecord(document);
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      if (input.sourceEventId) return null;
      if (input.clientRequestId) {
        const existing = await this.model
          .findOne({ user_id: input.userId, client_request_id: input.clientRequestId })
          .exec();
        if (
          existing &&
          isEqual(existing.data, input.data) &&
          isEqual(existing.temporal_reference, input.temporalReference)
        ) {
          return toRecord(existing);
        }
      }
      throw new WellbeingIdempotencyConflictError();
    }
  }

  async update(
    userId: string,
    id: string,
    expectedRevision: number,
    data: Record<string, unknown>,
    temporalReference: WellbeingRecord['temporalReference'],
    provenance: WellbeingRecord['provenance']
  ): Promise<WellbeingRecord | null> {
    const document = await this.model.findOneAndUpdate(
      { _id: id, user_id: userId, revision: expectedRevision },
      {
        $set: { data, temporal_reference: temporalReference, provenance },
        $push: { provenance_history: provenance },
        $inc: { revision: 1 }
      },
      { new: true }
    );
    if (document) return toRecord(document);
    const exists = await this.model.exists({ _id: id, user_id: userId });
    if (exists) throw new WellbeingRevisionConflictError();
    return null;
  }

  async delete(userId: string, id: string, expectedRevision: number): Promise<boolean> {
    const result = await this.model.deleteOne({
      _id: id,
      user_id: userId,
      revision: expectedRevision
    });
    if (result.deletedCount) return true;
    const exists = await this.model.exists({ _id: id, user_id: userId });
    if (exists) throw new WellbeingRevisionConflictError();
    return false;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId });
  }
}
