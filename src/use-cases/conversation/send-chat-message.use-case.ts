import { ReflectiveProfile } from '../../domain/conversation/entities/reflective-profile.entity';
import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { ChatAgent, ChatRiskLevel } from './chat-agent.port';

export interface SendChatMessageInput {
  userId: string;
  message: string;
}

export interface SendChatMessageOutput {
  reply: string;
  riskLevel: ChatRiskLevel;
  scopeStatus: ConversationScopeStatus;
}

export class ChatProviderUnavailableError extends Error {
  constructor() {
    super('Chat provider unavailable');
    this.name = 'ChatProviderUnavailableError';
  }
}

export class SendChatMessageUseCase {
  constructor(
    private readonly profileRepository: ReflectiveProfileRepository,
    private readonly chatAgent: ChatAgent,
    private readonly scopePolicy: ConversationScopePolicy
  ) {}

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const profile =
      (await this.profileRepository.findByUserId(input.userId)) ??
      ReflectiveProfile.create(input.userId);

    let agentResponse;
    try {
      agentResponse = await this.chatAgent.respond({
        message: input.message,
        profile: profile.toJson()
      });
    } catch {
      throw new ChatProviderUnavailableError();
    }

    const now = new Date();
    const profileUpdate = agentResponse.profileUpdate.shouldUpdate
      ? this.scopePolicy.resolveProfileUpdate(
          agentResponse.scopeStatus,
          agentResponse.profileUpdate
        )
      : undefined;

    if (profileUpdate) {
      profile.applyUpdate(profileUpdate, now);
    } else {
      profile.registerInteraction(now);
    }

    await this.profileRepository.save(profile);

    return {
      reply: this.scopePolicy.resolveReply(agentResponse.scopeStatus, agentResponse.reply),
      riskLevel: agentResponse.riskLevel,
      scopeStatus: agentResponse.scopeStatus
    };
  }
}
