import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import {
  CurrentContextDocument,
  CurrentContextMongo,
  MemoryDocument,
  MemoryMongo
} from './memory.schema';
import { CurrentContext, MemoryRecord, normalizeTopics } from './memory.types';

function toRecord(document: MemoryDocument): MemoryRecord {
  return {
    id: document._id,
    userId: document.user_id,
    recordType: document.record_type,
    summary: document.summary,
    kind: document.kind,
    topics: [...document.topics],
    eventDate: document.event_date,
    firstObservedAt: document.first_observed_at,
    lastObservedAt: document.last_observed_at,
    importance: document.importance,
    confidence: document.confidence,
    evidenceCount: document.evidence_count,
    origin: document.origin,
    capturedAt: document.captured_at,
    sessionId: document.session_id,
    sourceEventId: document.source_event_id,
    extractorVersion: document.extractor_version,
    promptVersion: document.prompt_version
  };
}

function queryTerms(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .split(/[^a-z0-9]+/)
      .filter((item) => item.length >= 4)
  );
}

@Injectable()
export class MemoryRepository {
  constructor(@InjectModel(MemoryMongo.name) private readonly model: Model<MemoryDocument>) {}

  async createMemory(
    input: Omit<MemoryRecord, 'id' | 'recordType' | 'evidenceCount'>
  ): Promise<boolean> {
    try {
      await this.model.create({
        _id: randomUUID(),
        user_id: input.userId,
        record_type: 'memory',
        summary: input.summary,
        kind: input.kind,
        topics: normalizeTopics(input.topics),
        event_date: input.eventDate,
        first_observed_at: input.firstObservedAt,
        last_observed_at: input.lastObservedAt,
        importance: input.importance,
        confidence: input.confidence,
        evidence_count: 1,
        origin: input.origin,
        captured_at: input.capturedAt,
        session_id: input.sessionId,
        source_event_id: input.sourceEventId,
        extractor_version: input.extractorVersion,
        prompt_version: input.promptVersion
      });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
  }

  async findRelevant(
    userId: string,
    recordType: 'memory' | 'pattern',
    currentMessage: string,
    limit: number
  ): Promise<MemoryRecord[]> {
    const documents = await this.model
      .find({ user_id: userId, record_type: recordType })
      .sort({ importance: -1, last_observed_at: -1 })
      .limit(40)
      .exec();
    const terms = queryTerms(currentMessage);

    return documents
      .map((document) => {
        const searchable = queryTerms(`${document.summary} ${document.topics.join(' ')}`);
        const overlap = [...terms].filter((term) => searchable.has(term)).length;
        const recencyDays = Math.max(
          0,
          (Date.now() - document.last_observed_at.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          document,
          score: overlap * 3 + document.importance * 2 + 1 / (1 + recencyDays / 30)
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ document }) => toRecord(document));
  }

  async countEvidence(userId: string, topics: string[]): Promise<{ count: number; first?: Date }> {
    const normalized = normalizeTopics(topics, 3).slice(0, 2);
    if (normalized.length < 2) return { count: 0 };
    const documents = await this.model
      .find({ user_id: userId, record_type: 'memory', topics: { $all: normalized } })
      .select({ first_observed_at: 1 })
      .sort({ first_observed_at: 1 })
      .exec();
    return { count: documents.length, first: documents[0]?.first_observed_at };
  }

  async upsertPattern(input: {
    userId: string;
    summary: string;
    topics: string[];
    evidenceCount: number;
    firstObservedAt: Date;
    lastObservedAt: Date;
    sourceEventId: string;
    sessionId: string;
    capturedAt: Date;
    promptVersion: string;
  }): Promise<void> {
    const topics = normalizeTopics(input.topics, 3).sort();
    const patternKey = topics.slice(0, 2).join('|');
    await this.model.updateOne(
      { user_id: input.userId, record_type: 'pattern', pattern_key: patternKey },
      {
        $set: {
          summary: input.summary,
          topics,
          last_observed_at: input.lastObservedAt,
          evidence_count: input.evidenceCount,
          source_event_id: input.sourceEventId,
          session_id: input.sessionId,
          captured_at: input.capturedAt,
          prompt_version: input.promptVersion
        },
        $setOnInsert: {
          _id: randomUUID(),
          user_id: input.userId,
          record_type: 'pattern',
          pattern_key: patternKey,
          kind: 'recurrence',
          first_observed_at: input.firstObservedAt,
          importance: 0.7,
          confidence: undefined,
          origin: 'chat'
        }
      },
      { upsert: true }
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId });
  }
}

@Injectable()
export class CurrentContextRepository {
  constructor(
    @InjectModel(CurrentContextMongo.name)
    private readonly model: Model<CurrentContextDocument>
  ) {}

  async findByUserId(userId: string): Promise<CurrentContext | null> {
    const document = await this.model.findById(userId).exec();
    return document
      ? {
          userId: document._id,
          summary: document.summary,
          topics: [...document.topics],
          pendingItems: [...document.pending_items],
          confidence: document.confidence,
          sourceEventId: document.source_event_id,
          sessionId: document.session_id,
          capturedAt: document.captured_at,
          updatedAt: document.updated_at ?? document.captured_at
        }
      : null;
  }

  async replace(input: Omit<CurrentContext, 'updatedAt'>): Promise<void> {
    const current = await this.model
      .findById(input.userId)
      .select({ source_event_id: 1 })
      .lean()
      .exec();
    if (current?.source_event_id === input.sourceEventId) return;

    await this.model.updateOne(
      { _id: input.userId },
      {
        $set: {
          summary: input.summary,
          topics: normalizeTopics(input.topics, 3),
          pending_items: input.pendingItems
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 3),
          confidence: input.confidence,
          source_event_id: input.sourceEventId,
          session_id: input.sessionId,
          captured_at: input.capturedAt
        },
        $setOnInsert: { _id: input.userId }
      },
      { upsert: true }
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteOne({ _id: userId });
  }
}
