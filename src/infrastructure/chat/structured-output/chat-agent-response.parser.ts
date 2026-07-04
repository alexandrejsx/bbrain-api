import { ConversationScopeStatus } from '../../../domain/conversation/services/conversation-scope-policy.service';
import {
  ChatAgentResponse,
  ChatProfileUpdate,
  ChatRiskLevel
} from '../../../use-cases/conversation/chat-agent.port';

const RISK_LEVELS = new Set<ChatRiskLevel>(['none', 'low', 'medium', 'high']);
const SCOPE_STATUSES = new Set<ConversationScopeStatus>(['in_scope', 'out_of_scope']);

const toOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const toStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;

const stripMarkdownFence = (value: string): string =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

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
  'reply' in value && 'riskLevel' in value && 'scopeStatus' in value && 'profileUpdate' in value;

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
    const detail = initialError instanceof Error ? initialError.message : 'unknown JSON error';
    throw new Error(`${providerName} returned malformed JSON: ${detail}`, {
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
  const profileUpdate = parsed.profileUpdate as Record<string, unknown> | undefined;

  if (
    typeof parsed.reply !== 'string' ||
    !parsed.reply.trim() ||
    typeof riskLevel !== 'string' ||
    !RISK_LEVELS.has(riskLevel as ChatRiskLevel) ||
    typeof scopeStatus !== 'string' ||
    !SCOPE_STATUSES.has(scopeStatus as ConversationScopeStatus) ||
    !profileUpdate ||
    typeof profileUpdate.shouldUpdate !== 'boolean'
  ) {
    throw new Error(`${providerName} returned an invalid structured response`);
  }

  const update: ChatProfileUpdate = {
    shouldUpdate: profileUpdate.shouldUpdate,
    currentContextSummary: toOptionalString(profileUpdate.currentContextSummary),
    recurringThemesToAdd: toStringArray(profileUpdate.recurringThemesToAdd),
    emotionalPatternsToAdd: toStringArray(profileUpdate.emotionalPatternsToAdd),
    routineNotesToAdd: toStringArray(profileUpdate.routineNotesToAdd),
    helpfulStrategiesToAdd: toStringArray(profileUpdate.helpfulStrategiesToAdd),
    unhelpfulStrategiesToAdd: toStringArray(profileUpdate.unhelpfulStrategiesToAdd),
    boundariesToAdd: toStringArray(profileUpdate.boundariesToAdd)
  };

  return {
    reply: parsed.reply.trim(),
    riskLevel: riskLevel as ChatRiskLevel,
    scopeStatus: scopeStatus as ConversationScopeStatus,
    profileUpdate: update
  };
}
