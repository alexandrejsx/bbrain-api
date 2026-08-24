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
}

export interface DailyCheckInMoodOutput {
  score: number | null;
  scoreConfidence: number | null;
  note: string | null;
}

export interface DailyCheckInOutput {
  extracted: {
    mood: DailyCheckInMoodOutput | null;
  };
  nextQuestion: string | null;
  completed: boolean;
  requiresSafetyHandoff: boolean;
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
  exactKeys(value, ['currentContext', 'memory', 'pattern']);
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
  return value as unknown as PostConversationOutput;
}

export function parseDailyCheckInOutput(text: string): DailyCheckInOutput {
  const value = parseObject(text);
  exactKeys(
    value,
    ['extracted', 'nextQuestion', 'completed', 'requiresSafetyHandoff'],
    invalidDailyCheckIn
  );
  if (!isRecord(value.extracted)) invalidDailyCheckIn();
  exactKeys(value.extracted, ['mood'], invalidDailyCheckIn);
  optionalObject(value.extracted.mood, (item) => {
    exactKeys(item, ['score', 'scoreConfidence', 'note'], invalidDailyCheckIn);
    nullableInteger(item.score, 0, 10, invalidDailyCheckIn);
    nullableNumberWith(item.scoreConfidence, 0, 1, invalidDailyCheckIn);
    nullableStringWith(item.note, 240, invalidDailyCheckIn);
  });
  nullableStringWith(value.nextQuestion, 320, invalidDailyCheckIn);
  booleanValue(value.completed, invalidDailyCheckIn);
  booleanValue(value.requiresSafetyHandoff, invalidDailyCheckIn);
  if (value.completed === true && value.nextQuestion !== null) invalidDailyCheckIn();
  return value as unknown as DailyCheckInOutput;
}

function invalidDailyCheckIn(): never {
  throw new Error('Invalid daily check-in structured output');
}

function invalid(): never {
  throw new Error('Invalid post-conversation structured output');
}

function exactKeys(
  value: Record<string, unknown>,
  expected: string[],
  fail: () => never = invalid
): void {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || expected.some((key) => !(key in value))) fail();
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

function nullableNumberWith(value: unknown, min: number, max: number, fail: () => never): void {
  if (value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail();
}

function nullableInteger(value: unknown, min: number, max: number, fail: () => never): void {
  nullableNumberWith(value, min, max, fail);
  if (value !== null && !Number.isInteger(value)) fail();
}

function nullableStringWith(value: unknown, maxLength: number, fail: () => never): void {
  if (value === null) return;
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) fail();
}

function booleanValue(value: unknown, fail: () => never): void {
  if (typeof value !== 'boolean') fail();
}

function enumValue(value: unknown, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) invalid();
}
