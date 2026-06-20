import { ConversationPolicy } from '../value-objects/conversation.value-objects';

export interface ConversationPolicyService {
  getDefaultPolicy(): ConversationPolicy;
  assertCanRespond(content: string): void;
}
