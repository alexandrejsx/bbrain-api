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

const PROFILE_SETUP_REPLIES = {
  'pt-BR':
    'Antes de continuarmos, quero conhecer um pouco melhor você para que o BBrain possa te acompanhar com mais cuidado. Vamos configurar seu perfil?',
  'en-US':
    'Before we continue, I would like to get to know you a little better so BBrain can support you with more care. Shall we set up your profile?',
  'es-ES':
    'Antes de continuar, me gustaría conocerte un poco mejor para que BBrain pueda acompañarte con más cuidado. ¿Configuramos tu perfil?'
} as const;

const LIMIT_CRISIS_REPLIES = {
  'pt-BR':
    'Sinto muito que você esteja passando por isso. Mesmo com o limite diário atingido, sua segurança vem primeiro: procure agora uma pessoa de confiança e não fique sozinho. Se houver risco imediato, vá para um lugar seguro e contate o serviço de emergência da sua região.',
  'en-US':
    'I am sorry you are going through this. Even with the daily limit reached, your safety comes first: contact someone you trust now and do not stay alone. If there is immediate risk, go somewhere safe and contact emergency services in your area.',
  'es-ES':
    'Siento mucho que estés pasando por esto. Aunque hayas alcanzado el límite diario, tu seguridad va primero: busca ahora a una persona de confianza y no te quedes a solas. Si hay riesgo inmediato, ve a un lugar seguro y contacta al servicio de emergencia de tu región.'
} as const;

type SupportedConversationLanguage = keyof typeof PROFILE_SETUP_REPLIES;

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
  acceptedLanguage?: string;
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
    const preferredLanguage = resolvePreferredLanguage(
      contextResult.context.userIdentityContext?.preferredLanguage,
      input.acceptedLanguage
    );
    const detectedMessageLanguage = detectMessageLanguage(input.message);
    const responseLanguage = detectedMessageLanguage ?? preferredLanguage;

    if (!contextResult.profileConfigured) {
      return {
        reply: PROFILE_SETUP_REPLIES[responseLanguage],
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
          reply: LIMIT_CRISIS_REPLIES[responseLanguage],
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
        context: contextResult.context,
        preferredLanguage,
        detectedMessageLanguage,
        responseLanguage
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

    const reply = this.scopePolicy.resolveReply(
      agentResponse.scopeStatus,
      agentResponse.reply,
      responseLanguage
    );
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

function resolvePreferredLanguage(
  profileLanguage?: string,
  acceptedLanguage?: string
): SupportedConversationLanguage {
  return (
    normalizeConversationLanguage(profileLanguage) ?? normalizeAcceptLanguage(acceptedLanguage)
  );
}

function normalizeAcceptLanguage(value?: string): SupportedConversationLanguage {
  const firstLanguage = value?.split(',')[0]?.trim();
  return normalizeConversationLanguage(firstLanguage) ?? 'pt-BR';
}

function normalizeConversationLanguage(value?: string): SupportedConversationLanguage | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return undefined;
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-ES';
  if (normalized.startsWith('pt')) return 'pt-BR';
  return undefined;
}

function detectMessageLanguage(message: string): SupportedConversationLanguage | undefined {
  const normalized = normalizeRiskText(message);
  const tokens = normalized.match(/[a-z]+/g) ?? [];

  if (tokens.length < 2) {
    return undefined;
  }

  const tokenSet = new Set(tokens);
  const englishScore = scoreLanguage(tokenSet, [
    'hi',
    'hello',
    'hey',
    'im',
    'i',
    'am',
    'very',
    'happy',
    'sad',
    'today',
    'feeling',
    'feel',
    'because',
    'thanks',
    'thank',
    'you',
    'my'
  ]);
  const spanishScore = scoreLanguage(tokenSet, [
    'hola',
    'estoy',
    'muy',
    'feliz',
    'triste',
    'hoy',
    'porque',
    'gracias',
    'siento',
    'me',
    'mi'
  ]);
  const portugueseScore = scoreLanguage(tokenSet, [
    'oi',
    'ola',
    'olá',
    'estou',
    'muito',
    'feliz',
    'triste',
    'hoje',
    'porque',
    'obrigado',
    'obrigada',
    'sinto',
    'meu',
    'minha'
  ]);
  const scores = [
    ['en-US', englishScore],
    ['es-ES', spanishScore],
    ['pt-BR', portugueseScore]
  ] as const;
  const [language, score] = scores.reduce((best, current) =>
    current[1] > best[1] ? current : best
  );

  return score > 0 ? language : undefined;
}

function scoreLanguage(tokenSet: Set<string>, markers: string[]): number {
  return markers.reduce(
    (total, marker) => total + (tokenSet.has(normalizeRiskText(marker)) ? 1 : 0),
    0
  );
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
