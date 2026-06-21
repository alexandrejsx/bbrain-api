import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { ChatProfileUpdate } from './chat-agent.port';

const PROFILE_UPDATE_LIST_LIMIT = 8;

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();

const cleanList = (values?: string[], sourceMessage?: string): string[] | undefined => {
  if (!values) return undefined;

  const normalizedMessage = sourceMessage ? normalizeForMatch(sourceMessage) : undefined;
  const cleaned = values
    .map((value) => value.trim())
    .filter(
      (value) =>
        value && (!normalizedMessage || normalizedMessage.includes(normalizeForMatch(value)))
    )
    .slice(0, PROFILE_UPDATE_LIST_LIMIT);

  return cleaned.length ? cleaned : undefined;
};

export class ProfileUpdateService {
  constructor(private readonly scopePolicy: ConversationScopePolicy) {}

  apply(
    profile: ReflectiveProfile,
    scopeStatus: ConversationScopeStatus,
    update: ChatProfileUpdate,
    sourceMessage: string,
    at: Date
  ): void {
    if (!update.shouldUpdate) {
      profile.registerInteraction(at);
      return;
    }

    const normalizedSummary = update.currentContextSummary?.trim().slice(0, 500);
    const allowedUpdate = this.scopePolicy.resolveProfileUpdate(scopeStatus, {
      currentContextSummary:
        normalizedSummary &&
        normalizeForMatch(normalizedSummary) !== normalizeForMatch(sourceMessage)
          ? normalizedSummary
          : undefined,
      recurringThemesToAdd: cleanList(update.recurringThemesToAdd, sourceMessage),
      emotionalPatternsToAdd: cleanList(update.emotionalPatternsToAdd, sourceMessage),
      routineNotesToAdd: cleanList(update.routineNotesToAdd, sourceMessage),
      helpfulStrategiesToAdd: cleanList(update.helpfulStrategiesToAdd, sourceMessage),
      unhelpfulStrategiesToAdd: cleanList(update.unhelpfulStrategiesToAdd, sourceMessage),
      boundariesToAdd: cleanList(update.boundariesToAdd, sourceMessage)
    });
    if (allowedUpdate) profile.applyUpdate(allowedUpdate, at);
    else profile.registerInteraction(at);
  }
}
