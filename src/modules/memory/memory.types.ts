export type MemoryRecordType = 'memory' | 'pattern';
export type MemoryKind = 'event' | 'fact' | 'preference' | 'relationship' | 'routine';
export type MemoryOrigin = 'chat' | 'profile' | 'manual';

export interface MemoryRecord {
  id: string;
  userId: string;
  recordType: MemoryRecordType;
  summary: string;
  kind: MemoryKind | 'recurrence';
  topics: string[];
  eventDate?: Date;
  firstObservedAt: Date;
  lastObservedAt: Date;
  importance: number;
  confidence?: number;
  evidenceCount: number;
  origin: MemoryOrigin;
  capturedAt: Date;
  sessionId?: string;
  sourceEventId?: string;
  extractorVersion?: string;
  promptVersion?: string;
}

export interface CurrentContext {
  userId: string;
  summary: string;
  topics: string[];
  pendingItems: string[];
  confidence?: number;
  sourceEventId: string;
  sessionId: string;
  capturedAt: Date;
  updatedAt: Date;
}

export function normalizeTopics(values: readonly string[], limit = 8): string[] {
  const topics = new Map<string, string>();
  for (const value of values) {
    const normalized = value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
    if (normalized && normalized.length <= 60) topics.set(normalized, normalized);
  }
  return [...topics.values()].slice(0, limit);
}
