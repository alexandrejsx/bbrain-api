import { Injectable } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';
import { normalizeTopics } from './memory.types';

@Injectable()
export class MemoryService {
  constructor(private readonly repository: MemoryRepository) {}

  async consolidate(input: {
    userId: string;
    memory: {
      summary: string;
      kind: 'event' | 'fact' | 'preference' | 'relationship' | 'routine';
      topics: string[];
      eventDate: string | null;
      importance: number;
      confidence: number;
    };
    pattern: { summary: string; topics: string[] } | null;
    sessionId: string;
    sourceEventId: string;
    capturedAt: Date;
    extractorVersion: string;
    promptVersion: string;
    patternPromptVersion: string;
  }): Promise<void> {
    const topics = normalizeTopics(input.memory.topics);
    if (!input.memory.summary.trim() || topics.length === 0) return;

    const eventDate = input.memory.eventDate ? new Date(input.memory.eventDate) : undefined;
    const created = await this.repository.createMemory({
      userId: input.userId,
      summary: input.memory.summary.trim().slice(0, 280),
      kind: input.memory.kind,
      topics,
      eventDate: eventDate && Number.isFinite(eventDate.getTime()) ? eventDate : undefined,
      firstObservedAt: input.capturedAt,
      lastObservedAt: input.capturedAt,
      importance: clamp(input.memory.importance),
      confidence: clamp(input.memory.confidence),
      origin: 'chat',
      capturedAt: input.capturedAt,
      sessionId: input.sessionId,
      sourceEventId: input.sourceEventId,
      extractorVersion: input.extractorVersion,
      promptVersion: input.promptVersion
    });
    if (!created || !input.pattern || !input.pattern.summary.trim()) return;

    const patternTopics = normalizeTopics(input.pattern.topics, 3);
    if (patternTopics.length < 2) return;
    const evidence = await this.repository.countEvidence(input.userId, patternTopics);
    if (evidence.count < 2 || !evidence.first) return;

    await this.repository.upsertPattern({
      userId: input.userId,
      summary: input.pattern.summary.trim().slice(0, 280),
      topics: patternTopics,
      evidenceCount: evidence.count,
      firstObservedAt: evidence.first,
      lastObservedAt: input.capturedAt,
      sourceEventId: input.sourceEventId,
      sessionId: input.sessionId,
      capturedAt: input.capturedAt,
      promptVersion: input.patternPromptVersion
    });
  }
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
