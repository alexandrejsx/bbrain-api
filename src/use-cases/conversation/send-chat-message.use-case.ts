import { ReflectiveProfileRepository } from '../../domain/conversation/repositories/reflective-profile.repository';
import {
  ConversationScopePolicy,
  ConversationScopeStatus
} from '../../domain/conversation/services/conversation-scope-policy.service';
import { UsageLimitError, UsageService } from '../../domain/usage/services/usage.service';
import { AIContextService } from '../../modules/ai-context/ai-context.service';
import { AIContextMessageRepository } from '../../modules/ai-context/ai-context-message.repository';
import { ChatAgent, ChatRiskLevel } from './chat-agent.port';
import { ProfileUpdateService } from './profile-update.service';

const PROFILE_SETUP_REPLY =
  'Antes de continuarmos, quero conhecer um pouco melhor você para que o BBrain possa te acompanhar com mais cuidado. Vamos configurar seu perfil?';

const LIMIT_CRISIS_REPLY =
  'Sinto muito que você esteja passando por isso. Mesmo com o limite diário atingido, sua segurança vem primeiro: procure agora uma pessoa de confiança e não fique sozinho. Se houver risco imediato, vá para um lugar seguro e contate o serviço de emergência da sua região.';

const HIGH_RISK_KEYWORDS = [
  'suicid',
  'me matar',
  'tirar minha vida',
  'nao quero viver',
  'não quero viver',
  'nao aguento mais viver',
  'não aguento mais viver',
  'me machucar'
] as const;

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
    private readonly messageRepository: AIContextMessageRepository,
    private readonly usageService: UsageService
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

    try {
      await this.usageService.assertCanSendMessage(input.userId, input.message);
    } catch (error) {
      if (error instanceof UsageLimitError && hasHighRiskSignal(input.message)) {
        return {
          reply: LIMIT_CRISIS_REPLY,
          riskLevel: 'high',
          scopeStatus: 'in_scope'
        };
      }

      throw error;
    }

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
    await this.usageService.registerLlmUsage(input.userId, agentResponse.usage);

    return {
      reply,
      riskLevel: agentResponse.riskLevel,
      scopeStatus: agentResponse.scopeStatus
    };
  }
}

function normalizeRiskText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasHighRiskSignal(message: string): boolean {
  const normalizedMessage = normalizeRiskText(message);

  return HIGH_RISK_KEYWORDS.some((keyword) =>
    normalizedMessage.includes(normalizeRiskText(keyword))
  );
}
