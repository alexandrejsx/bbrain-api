import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { AIContextService } from '../../modules/ai-context/ai-context.service';
import { AIContextMessageRepository } from '../../modules/ai-context/ai-context-message.repository';
import { ChatAgent, ChatRiskLevel } from './chat-agent.port';
import { ProfileUpdateService } from './profile-update.service';

const PROFILE_SETUP_REPLY =
  'Antes de continuarmos, quero conhecer um pouco melhor você para que o BBrain possa te acompanhar com mais cuidado. Vamos configurar seu perfil?';

export interface SendChatMessageInput {
  userId: string;
  conversationId?: string;
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
    private readonly scopePolicy: ConversationScopePolicy,
    private readonly aiContextService: AIContextService,
    private readonly profileUpdateService: ProfileUpdateService,
    private readonly messageRepository: AIContextMessageRepository
  ) {}

  async execute(input: SendChatMessageInput): Promise<SendChatMessageOutput> {
    const contextResult = await this.aiContextService.build(input.userId, input.conversationId);

    if (!contextResult.profileConfigured) {
      return {
        reply: PROFILE_SETUP_REPLY,
        riskLevel: 'none',
        scopeStatus: 'in_scope'
      };
    }

    const profile = contextResult.sourceProfile;
    if (!profile) throw new Error('Configured reflective profile was not found');

    let agentResponse;
    try {
      agentResponse = await this.chatAgent.respond({
        message: input.message,
        context: contextResult.context
      });
    } catch {
      throw new ChatProviderUnavailableError();
    }

    const now = new Date();
    this.profileUpdateService.apply(
      profile,
      agentResponse.scopeStatus,
      agentResponse.profileUpdate,
      input.message,
      now
    );

    const reply = this.scopePolicy.resolveReply(agentResponse.scopeStatus, agentResponse.reply);
    const persistenceTasks: Promise<void>[] = [this.profileRepository.save(profile)];

    if (input.conversationId) {
      persistenceTasks.push(
        this.messageRepository.appendExchange(
          input.userId,
          input.conversationId,
          input.message,
          reply,
          now
        )
      );
    }

    await Promise.all(persistenceTasks);

    return {
      reply,
      riskLevel: agentResponse.riskLevel,
      scopeStatus: agentResponse.scopeStatus
    };
  }
}
