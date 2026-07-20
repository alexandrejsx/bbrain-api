import { ConversationScopeStatus } from '../../../domain/conversation/services/conversation-scope-policy.service';
import {
  ChatAgentResponse,
  ChatConversationStateUpdate,
  ChatRiskLevel
} from '../../../use-cases/conversation/chat-agent.port';
import {
  CONVERSATION_ASSISTANT_INTENTS,
  CONVERSATION_PENDING_QUESTION_CODES,
  CONVERSATION_SAFETY_STATES,
  CONVERSATION_SUPPORT_CONTEXTS
} from '../../../domain/conversation/entities/conversation-state.entity';

const RISK_LEVELS = new Set<ChatRiskLevel>(['none', 'low', 'medium', 'high']);
const SCOPE_STATUSES = new Set<ConversationScopeStatus>(['in_scope', 'out_of_scope']);
const TOP_LEVEL_KEYS = ['reply', 'riskLevel', 'scopeStatus', 'conversationStateUpdate'];
const STATE_UPDATE_KEYS = [
  'shouldUpdate',
  'currentTopic',
  'currentConcerns',
  'userNeeds',
  'supportContext',
  'safetyState',
  'pendingQuestionCode',
  'lastAssistantIntent'
];

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const stripMarkdownFence = (value: string): string =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};

const isValidStateStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 5 &&
  value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 100);

const removeTrailingCommas = (value: string): string => {
  let result = '';
  let insideString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (insideString) {
      result += character;

      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        insideString = false;
      }

      continue;
    }

    if (character === '"') {
      insideString = true;
      result += character;
      continue;
    }

    if (character === ',') {
      let nextIndex = index + 1;

      while (nextIndex < value.length && /\s/.test(value[nextIndex])) {
        nextIndex += 1;
      }

      if (value[nextIndex] === '}' || value[nextIndex] === ']') {
        continue;
      }
    }

    result += character;
  }

  return result;
};

const parseJsonObject = (value: string): Record<string, unknown> | undefined => {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(normalized);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    const repaired = removeTrailingCommas(normalized);

    if (repaired === normalized) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(repaired);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
};

const extractMarkdownFenceContents = (value: string): string[] =>
  Array.from(value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (match) => match[1].trim()).filter(
    Boolean
  );

const extractJsonObjectCandidates = (value: string): string[] => {
  const candidates: string[] = [];

  for (let start = 0; start < value.length; start += 1) {
    if (value[start] !== '{') {
      continue;
    }

    let depth = 0;
    let insideString = false;
    let escaped = false;

    for (let end = start; end < value.length; end += 1) {
      const character = value[end];

      if (insideString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          insideString = false;
        }

        continue;
      }

      if (character === '"') {
        insideString = true;
        continue;
      }

      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;

        if (depth === 0) {
          candidates.push(value.slice(start, end + 1));
          break;
        }
      }
    }
  }

  return candidates;
};

const looksLikeStructuredChatResponse = (value: Record<string, unknown>): boolean =>
  'reply' in value &&
  'riskLevel' in value &&
  'scopeStatus' in value &&
  'conversationStateUpdate' in value;

const parseStructuredJson = (outputText: string, providerName: string): Record<string, unknown> => {
  const normalized = stripMarkdownFence(outputText);
  const directParsed = parseJsonObject(normalized);

  if (directParsed) {
    return directParsed;
  }

  const candidates = [
    ...extractMarkdownFenceContents(outputText),
    ...extractJsonObjectCandidates(outputText)
  ];
  const uniqueCandidates = [...new Set(candidates)];
  let fallbackCandidate: Record<string, unknown> | undefined;

  for (const candidate of uniqueCandidates) {
    const parsedCandidate = parseJsonObject(candidate);

    if (!parsedCandidate) {
      continue;
    }

    if (looksLikeStructuredChatResponse(parsedCandidate)) {
      return parsedCandidate;
    }

    fallbackCandidate ??= parsedCandidate;
  }

  if (fallbackCandidate) {
    return fallbackCandidate;
  }

  try {
    JSON.parse(normalized);
    throw new Error(
      `${providerName} returned malformed JSON: top-level JSON value is not an object`
    );
  } catch (initialError) {
    throw new Error(`${providerName} returned malformed JSON`, {
      cause: initialError
    });
  }
};

export function parseChatAgentResponse(
  outputText: string,
  providerName: string
): Omit<ChatAgentResponse, 'usage'> {
  const parsed = parseStructuredJson(outputText, providerName);
  const riskLevel = parsed.riskLevel;
  const scopeStatus = parsed.scopeStatus;
  const stateUpdate = parsed.conversationStateUpdate as Record<string, unknown> | undefined;
  const currentTopic = stateUpdate?.currentTopic;

  if (
    typeof parsed.reply !== 'string' ||
    !parsed.reply.trim() ||
    typeof riskLevel !== 'string' ||
    !RISK_LEVELS.has(riskLevel as ChatRiskLevel) ||
    typeof scopeStatus !== 'string' ||
    !SCOPE_STATUSES.has(scopeStatus as ConversationScopeStatus) ||
    !stateUpdate ||
    !hasOnlyKeys(parsed, TOP_LEVEL_KEYS) ||
    !hasOnlyKeys(stateUpdate, STATE_UPDATE_KEYS) ||
    typeof stateUpdate.shouldUpdate !== 'boolean' ||
    !(currentTopic === null || (typeof currentTopic === 'string' && currentTopic.length <= 100)) ||
    !isValidStateStringArray(stateUpdate.currentConcerns) ||
    !isValidStateStringArray(stateUpdate.userNeeds) ||
    typeof stateUpdate.supportContext !== 'string' ||
    !CONVERSATION_SUPPORT_CONTEXTS.includes(
      stateUpdate.supportContext as (typeof CONVERSATION_SUPPORT_CONTEXTS)[number]
    ) ||
    typeof stateUpdate.safetyState !== 'string' ||
    !CONVERSATION_SAFETY_STATES.includes(
      stateUpdate.safetyState as (typeof CONVERSATION_SAFETY_STATES)[number]
    ) ||
    typeof stateUpdate.pendingQuestionCode !== 'string' ||
    !CONVERSATION_PENDING_QUESTION_CODES.includes(
      stateUpdate.pendingQuestionCode as (typeof CONVERSATION_PENDING_QUESTION_CODES)[number]
    ) ||
    typeof stateUpdate.lastAssistantIntent !== 'string' ||
    !CONVERSATION_ASSISTANT_INTENTS.includes(
      stateUpdate.lastAssistantIntent as (typeof CONVERSATION_ASSISTANT_INTENTS)[number]
    )
  ) {
    throw new Error(`${providerName} returned an invalid structured response`);
  }

  const update: ChatConversationStateUpdate = {
    shouldUpdate: stateUpdate.shouldUpdate,
    currentTopic: toOptionalString(stateUpdate.currentTopic),
    currentConcerns: stateUpdate.currentConcerns,
    userNeeds: stateUpdate.userNeeds,
    supportContext: stateUpdate.supportContext as ChatConversationStateUpdate['supportContext'],
    safetyState: stateUpdate.safetyState as ChatConversationStateUpdate['safetyState'],
    pendingQuestionCode:
      stateUpdate.pendingQuestionCode as ChatConversationStateUpdate['pendingQuestionCode'],
    lastAssistantIntent:
      stateUpdate.lastAssistantIntent as ChatConversationStateUpdate['lastAssistantIntent']
  };

  return {
    reply: parsed.reply.trim(),
    riskLevel: riskLevel as ChatRiskLevel,
    scopeStatus: scopeStatus as ConversationScopeStatus,
    conversationStateUpdate: update
  };
}
