import {
  CONVERSATION_ASSISTANT_INTENTS,
  CONVERSATION_PENDING_QUESTION_CODES,
  CONVERSATION_SAFETY_STATES,
  CONVERSATION_SUPPORT_CONTEXTS,
  ConversationState,
  ConversationStateSnapshot
} from '../entities/conversation-state.entity';

export interface ProposedConversationState extends ConversationStateSnapshot {
  shouldUpdate: boolean;
}

const CLINICAL_LABEL =
  /\b(mania|man[ií]ac\w*|manic|bipolar\w*|depress\w*|ansiedade|ansiedad|anxiety|transtorno\w*|trastorno\w*|disorder\w*|diagn[oó]stic\w*|diagnosis|tdah|adhd|autis\w*|psicose|psychosis|esquizofren\w*|schizo\w*)\b/iu;

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

const cleanText = (value: string | undefined, maxLength: number): string | undefined => {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > maxLength || CLINICAL_LABEL.test(cleaned)) return undefined;
  return cleaned;
};

const isCopiedPassage = (value: string, sourceTexts: string[]): boolean => {
  const normalized = normalize(value);
  if (normalized.length < 12) return false;
  return sourceTexts.some((source) => normalize(source).includes(normalized));
};

const cleanList = (values: string[], sourceTexts: string[]): string[] | undefined => {
  if (!Array.isArray(values) || values.length > 5) return undefined;
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value, 100);
    if (!cleaned || isCopiedPassage(cleaned, sourceTexts)) return undefined;
    if (!result.some((item) => normalize(item) === normalize(cleaned))) result.push(cleaned);
  }
  return result;
};

export class ConversationStateUpdatePolicy {
  buildNext(
    userId: string,
    conversationId: string,
    current: ConversationState | null,
    proposal: ProposedConversationState,
    currentUserMessage: string,
    assistantReply: string,
    now: Date,
    ttlHours: number
  ): { state: ConversationState; expectedRevision: number } | undefined {
    if (!proposal.shouldUpdate || !Number.isFinite(ttlHours) || ttlHours <= 0) return undefined;

    const sourceTexts = [currentUserMessage, assistantReply];
    const currentTopic = cleanText(proposal.currentTopic, 100);
    if (proposal.currentTopic && (!currentTopic || isCopiedPassage(currentTopic, sourceTexts))) {
      return undefined;
    }
    const currentConcerns = cleanList(proposal.currentConcerns, sourceTexts);
    const userNeeds = cleanList(proposal.userNeeds, sourceTexts);
    if (!currentConcerns || !userNeeds) return undefined;
    if (!CONVERSATION_SUPPORT_CONTEXTS.includes(proposal.supportContext)) return undefined;
    if (!CONVERSATION_SAFETY_STATES.includes(proposal.safetyState)) return undefined;
    if (!CONVERSATION_PENDING_QUESTION_CODES.includes(proposal.pendingQuestionCode)) {
      return undefined;
    }
    if (!CONVERSATION_ASSISTANT_INTENTS.includes(proposal.lastAssistantIntent)) return undefined;

    const snapshot: ConversationStateSnapshot = {
      currentTopic,
      currentConcerns,
      userNeeds,
      supportContext: proposal.supportContext,
      safetyState: proposal.safetyState,
      pendingQuestionCode: proposal.pendingQuestionCode,
      lastAssistantIntent: proposal.lastAssistantIntent
    };
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    if (current) {
      const expectedRevision = current.revision;
      current.replace(snapshot, now, expiresAt);
      return { state: current, expectedRevision };
    }

    return {
      state: ConversationState.create({ userId, conversationId }, snapshot, now, expiresAt),
      expectedRevision: 0
    };
  }
}
