export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type ScopeStatus = 'in_scope' | 'out_of_scope';

export interface ConversationOutput {
  reply: string;
  riskLevel: RiskLevel;
  scopeStatus: ScopeStatus;
}

export interface PostConversationOutput {
  currentContext: null | {
    summary: string;
    topics: string[];
    pendingItems: string[];
    confidence: number;
  };
  memory: null | {
    summary: string;
    kind: 'event' | 'fact' | 'preference' | 'relationship' | 'routine';
    topics: string[];
    eventDate: string | null;
    importance: number;
    confidence: number;
  };
  pattern: null | { summary: string; topics: string[] };
  mood: null | {
    primaryEmotion: string;
    secondaryEmotions: string[];
    intensity: number | null;
    energy: number | null;
    valence: number | null;
    occurredAt: string | null;
    period: string | null;
    context: string | null;
    confidence: number;
  };
  sleep: null | {
    durationMinutes: number | null;
    durationMinMinutes: number | null;
    durationMaxMinutes: number | null;
    bedtime: string | null;
    wakeTime: string | null;
    quality: string | null;
    awakenings: number | null;
    wakeFeeling: string | null;
    date: string | null;
    period: string | null;
    precision: 'exact' | 'approximate';
    confidence: number;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function parseObject(text: string): Record<string, unknown> {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error('Structured output must be an object');
  return value;
}

export function parseConversationOutput(text: string): ConversationOutput {
  const value = parseObject(text);
  if (
    Object.keys(value).length !== 3 ||
    !['reply', 'riskLevel', 'scopeStatus'].every((key) => key in value)
  ) {
    throw new Error('Invalid conversation structured output');
  }
  const risks = ['none', 'low', 'medium', 'high'];
  const scopes = ['in_scope', 'out_of_scope'];
  if (
    typeof value.reply !== 'string' ||
    !value.reply.trim() ||
    value.reply.length > 4000 ||
    !risks.includes(String(value.riskLevel)) ||
    !scopes.includes(String(value.scopeStatus))
  ) {
    throw new Error('Invalid conversation structured output');
  }
  return {
    reply: value.reply.trim(),
    riskLevel: value.riskLevel as RiskLevel,
    scopeStatus: value.scopeStatus as ScopeStatus
  };
}

export function parsePostConversationOutput(text: string): PostConversationOutput {
  const value = parseObject(text);
  exactKeys(value, ['currentContext', 'memory', 'pattern', 'mood', 'sleep']);
  optionalObject(value.currentContext, (item) => {
    exactKeys(item, ['summary', 'topics', 'pendingItems', 'confidence']);
    stringValue(item.summary, 320);
    stringArray(item.topics, 8, 60, true);
    stringArray(item.pendingItems, 3, 120, true);
    boundedNumber(item.confidence, 0, 1);
  });
  optionalObject(value.memory, (item) => {
    exactKeys(item, ['summary', 'kind', 'topics', 'eventDate', 'importance', 'confidence']);
    stringValue(item.summary, 280);
    enumValue(item.kind, ['event', 'fact', 'preference', 'relationship', 'routine']);
    stringArray(item.topics, 8, 60, true);
    nullableString(item.eventDate, 40);
    boundedNumber(item.importance, 0, 1);
    boundedNumber(item.confidence, 0, 1);
  });
  optionalObject(value.pattern, (item) => {
    exactKeys(item, ['summary', 'topics']);
    stringValue(item.summary, 280);
    stringArray(item.topics, 8, 60, true);
  });
  optionalObject(value.mood, (item) => {
    exactKeys(item, [
      'primaryEmotion',
      'secondaryEmotions',
      'intensity',
      'energy',
      'valence',
      'occurredAt',
      'period',
      'context',
      'confidence'
    ]);
    stringValue(item.primaryEmotion, 60);
    stringArray(item.secondaryEmotions, 4, 60, true);
    nullableNumber(item.intensity, 0, 10);
    nullableNumber(item.energy, 0, 10);
    nullableNumber(item.valence, -1, 1);
    nullableString(item.occurredAt, 40);
    nullableString(item.period, 120);
    nullableString(item.context, 180);
    boundedNumber(item.confidence, 0, 1);
  });
  optionalObject(value.sleep, (item) => {
    exactKeys(item, [
      'durationMinutes',
      'durationMinMinutes',
      'durationMaxMinutes',
      'bedtime',
      'wakeTime',
      'quality',
      'awakenings',
      'wakeFeeling',
      'date',
      'period',
      'precision',
      'confidence'
    ]);
    nullableNumber(item.durationMinutes, 1, 1440);
    nullableNumber(item.durationMinMinutes, 1, 1440);
    nullableNumber(item.durationMaxMinutes, 1, 1440);
    nullableString(item.bedtime, 5);
    nullableString(item.wakeTime, 5);
    nullableString(item.quality, 60);
    nullableNumber(item.awakenings, 0, 100);
    nullableString(item.wakeFeeling, 60);
    nullableString(item.date, 10);
    nullableString(item.period, 120);
    enumValue(item.precision, ['exact', 'approximate']);
    boundedNumber(item.confidence, 0, 1);
  });
  return value as unknown as PostConversationOutput;
}

function invalid(): never {
  throw new Error('Invalid post-conversation structured output');
}

function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key) => !(key in value))) invalid();
}

function optionalObject(value: unknown, validate: (item: Record<string, unknown>) => void): void {
  if (value === null) return;
  if (!isRecord(value)) invalid();
  validate(value);
}

function stringValue(value: unknown, maxLength: number): void {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) invalid();
}

function nullableString(value: unknown, maxLength: number): void {
  if (value === null) return;
  stringValue(value, maxLength);
}

function stringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
  allowEmpty = false
): void {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > maxItems ||
    value.some((item) => typeof item !== 'string' || !item.trim() || item.length > maxLength)
  ) {
    invalid();
  }
}

function boundedNumber(value: unknown, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid();
}

function nullableNumber(value: unknown, min: number, max: number): void {
  if (value === null) return;
  boundedNumber(value, min, max);
}

function enumValue(value: unknown, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) invalid();
}
