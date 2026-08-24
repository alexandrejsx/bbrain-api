import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { isEqual } from 'lodash';
import { FilterQuery, Model } from 'mongoose';
import { MoodDocument, MoodMongo } from './mood.schema';
import {
  WellbeingDailyRecordConflictError,
  WellbeingIdempotencyConflictError,
  WellbeingRecord,
  WellbeingRevisionConflictError
} from '../wellbeing/wellbeing.types';

function toRecord(document: MoodDocument): WellbeingRecord {
  return {
    id: document._id,
    userId: document.user_id,
    recordDate: document.record_date,
    kind: document.kind,
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
export class MoodRepository {
  constructor(@InjectModel(MoodMongo.name) private readonly model: Model<MoodDocument>) {}

  async list(userId: string, kinds?: string[]): Promise<WellbeingRecord[]> {
    const documents = await this.model
      .find({ user_id: userId, ...(kinds?.length ? { kind: { $in: kinds } } : {}) })
      .sort({ record_date: -1, captured_at: -1 })
      .exec();
    return documents.map(toRecord);
  }

  async listInRange(userId: string, startsOn: string, endsOn: string) {
    const documents = await this.model
      .find(this.rangeQuery(userId, startsOn, endsOn))
      .sort({ record_date: -1, captured_at: -1 })
      .exec();
    return documents.map(toRecord);
  }

  async listPageInRange(
    userId: string,
    startsOn: string,
    endsOn: string,
    page: number,
    pageSize: number
  ) {
    const query = this.rangeQuery(userId, startsOn, endsOn);
    const [documents, totalItems] = await Promise.all([
      this.model
        .find(query)
        .sort({ record_date: -1, captured_at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.model.countDocuments(query).exec()
    ]);
    return { items: documents.map(toRecord), totalItems };
  }

  async findById(userId: string, id: string): Promise<WellbeingRecord | null> {
    const document = await this.model.findOne({ _id: id, user_id: userId }).exec();
    return document ? toRecord(document) : null;
  }

  async findByRecordDate(userId: string, recordDate: string): Promise<WellbeingRecord | null> {
    const document = await this.model.findOne({ user_id: userId, record_date: recordDate }).exec();
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
        record_date: input.recordDate,
        kind: input.kind,
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
      if (input.sourceEventId) {
        const existing = await this.model
          .findOne({ user_id: input.userId, source_event_id: input.sourceEventId })
          .exec();
        if (existing) return null;
      }
      if (input.clientRequestId) {
        const existing = await this.model
          .findOne({ user_id: input.userId, client_request_id: input.clientRequestId })
          .exec();
        if (
          existing &&
          existing.kind === input.kind &&
          isEqual(existing.data, input.data) &&
          isEqual(existing.temporal_reference, input.temporalReference)
        ) {
          return toRecord(existing);
        }
        if (existing) throw new WellbeingIdempotencyConflictError();
      }
      if (await this.model.exists({ user_id: input.userId, record_date: input.recordDate })) {
        throw new WellbeingDailyRecordConflictError(input.recordDate);
      }
      throw new WellbeingIdempotencyConflictError();
    }
  }

  async update(
    userId: string,
    id: string,
    expectedRevision: number,
    recordDate: string,
    data: Record<string, unknown>,
    temporalReference: WellbeingRecord['temporalReference'],
    provenance: WellbeingRecord['provenance']
  ): Promise<WellbeingRecord | null> {
    let document: MoodDocument | null;
    try {
      document = await this.model.findOneAndUpdate(
        { _id: id, user_id: userId, revision: expectedRevision },
        {
          $set: {
            record_date: recordDate,
            data,
            temporal_reference: temporalReference,
            provenance
          },
          $push: { provenance_history: provenance },
          $inc: { revision: 1 }
        },
        { new: true }
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new WellbeingDailyRecordConflictError(recordDate);
      }
      throw error;
    }
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

  async deleteSeedRecords(userId: string, clientRequestPrefix: string): Promise<number> {
    const result = await this.model.deleteMany({
      user_id: userId,
      client_request_id: { $gte: clientRequestPrefix, $lt: `${clientRequestPrefix}\uffff` }
    });
    return result.deletedCount;
  }

  private rangeQuery(userId: string, startsOn: string, endsOn: string): FilterQuery<MoodDocument> {
    return {
      user_id: userId,
      record_date: { $gte: startsOn, $lte: endsOn }
    };
  }
}
