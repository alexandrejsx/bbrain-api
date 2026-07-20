import { ChatAgentResponse } from './chat-agent.port';
import { ConversationAgentContext } from './conversation-agent-context';

interface ConversationSafetyReplyInput {
  currentUserMessage: string;
  context: ConversationAgentContext;
  responseLanguage: string;
  response: ChatAgentResponse;
}

const SELF_REPORTED_MANIA =
  /\b(?:(?:acho|creio|acredito|penso|sinto|i think|i believe|i feel|creo|pienso|siento)\b.{0,64}|(?:estou|esteja|estar|sou|i am|i might be|estoy|estar)\s+(?:em\s+|en\s+)?)\b(mania|man[ií]aco|man[ií]aca|manic)\b/iu;
const ONLY_BBRAIN =
  /\b(somente|apenas|s[oó]|only|solo|solamente)\b.{0,24}(voc[eê]|bbrain|you|t[uú])/iu;
const IMPULSE_CONCERN = /\b(impuls|controle|control)\w*/iu;
const NO_IMMEDIATE_RISK = /^(?:n[aã]o|nada|no|nope|not really)$/iu;
const PROHIBITED_REPLY =
  /estamos sozinhos nessa|s[oó] precisa de mim|falta de necessidade de sono|energia elevada|voc[eê] est[aá] em mania|we are alone in this|you are manic|solo me necesitas|est[aá]s en man[ií]a/iu;

const replies = {
  selfLabel: {
    pt: 'Eu não consigo confirmar se isso é mania. Posso considerar apenas o que você relatou, sem acrescentar sintomas, e vale buscar uma avaliação profissional se essa suspeita continuar. O que está sendo mais difícil de manejar agora?',
    en: 'I cannot confirm whether this is mania. I can only consider what you have reported, without adding symptoms, and it is worth seeking a professional assessment if this concern continues. What feels hardest to manage right now?',
    es: 'No puedo confirmar si esto es manía. Solo puedo considerar lo que has relatado, sin añadir síntomas, y conviene buscar una evaluación profesional si esta preocupación continúa. ¿Qué es lo más difícil de manejar ahora?'
  },
  impulseSafety: {
    pt: 'Eu não consigo confirmar se isso é mania. Posso ficar apenas no que você relatou: está difícil controlar impulsos. Neste momento, você sente que pode agir de uma forma que coloque você ou outra pessoa em risco?',
    en: 'I cannot confirm whether this is mania. I can stay only with what you reported: controlling impulses feels difficult. Right now, do you feel you might act in a way that could put you or someone else at risk?',
    es: 'No puedo confirmar si esto es manía. Puedo quedarme únicamente con lo que relataste: te resulta difícil controlar los impulsos. En este momento, ¿sientes que podrías actuar de una forma que te ponga a ti o a otra persona en riesgo?'
  },
  humanSupportFollowup: {
    pt: 'Entendi que você não percebe um risco imediato agora. Como ainda está difícil controlar impulsos, existe alguém de confiança ou um profissional com quem você possa entrar em contato hoje?',
    en: 'I understand that you do not notice an immediate risk right now. Since controlling impulses is still difficult, is there someone you trust or a professional you could contact today?',
    es: 'Entiendo que no percibes un riesgo inmediato ahora. Como todavía es difícil controlar los impulsos, ¿hay alguien de confianza o un profesional con quien puedas contactar hoy?'
  },
  exclusiveSupport: {
    pt: 'Obrigado por me contar. Não quero ser seu único apoio. A dificuldade para controlar impulsos e não ter alguém por perto merecem apoio humano e, se possível, profissional. Neste momento, você sente que pode agir de uma forma que coloque você ou outra pessoa em risco?',
    en: 'Thank you for telling me. I should not be your only support. Difficulty controlling impulses without someone nearby deserves human and, if possible, professional support. Right now, do you feel you might act in a way that could put you or someone else at risk?',
    es: 'Gracias por contármelo. No debo ser tu único apoyo. La dificultad para controlar impulsos sin alguien cerca merece apoyo humano y, si es posible, profesional. En este momento, ¿sientes que podrías actuar de una forma que te ponga a ti o a otra persona en riesgo?'
  },
  dependencyBoundary: {
    pt: 'Obrigado pela confiança. Posso conversar com você, mas não devo ser seu único apoio. Existe alguém de confiança ou um profissional com quem você possa entrar em contato hoje?',
    en: 'Thank you for trusting me. I can talk with you, but I should not be your only support. Is there someone you trust or a professional you could contact today?',
    es: 'Gracias por confiar en mí. Puedo conversar contigo, pero no debo ser tu único apoyo. ¿Hay alguien de confianza o un profesional con quien puedas contactar hoy?'
  },
  corrective: {
    pt: 'Quero corrigir a direção: não posso confirmar rótulos clínicos nem acrescentar sintomas que você não relatou. Podemos ficar no que você percebe concretamente. O que está mais difícil agora?',
    en: 'I want to correct course: I cannot confirm clinical labels or add symptoms you did not report. We can stay with what you are noticing directly. What feels hardest right now?',
    es: 'Quiero corregir el rumbo: no puedo confirmar etiquetas clínicas ni añadir síntomas que no relataste. Podemos centrarnos en lo que percibes directamente. ¿Qué es lo más difícil ahora?'
  }
} as const;

type ReplyLanguage = keyof (typeof replies)['selfLabel'];

const languageKey = (language: string): ReplyLanguage => {
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('es')) return 'es';
  return 'pt';
};

export class ConversationSafetyReplyPolicy {
  resolve(input: ConversationSafetyReplyInput): ChatAgentResponse {
    const current = input.context.conversationState;
    const language = languageKey(input.responseLanguage);
    const selfLabel = SELF_REPORTED_MANIA.test(input.currentUserMessage);
    const mentionsImpulse = IMPULSE_CONCERN.test(input.currentUserMessage);
    const onlyBbrain = ONLY_BBRAIN.test(input.currentUserMessage);
    const needsSafetyCheck =
      current?.pendingQuestionCode === 'human_support_available' ||
      current?.safetyState === 'needs_check' ||
      current?.supportContext === 'none_reported' ||
      current?.currentConcerns.some((concern) => IMPULSE_CONCERN.test(concern)) === true;

    if (onlyBbrain && needsSafetyCheck) {
      return {
        ...input.response,
        reply: replies.exclusiveSupport[language],
        riskLevel: input.response.riskLevel === 'high' ? 'high' : 'medium',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: current?.currentTopic,
          currentConcerns: current?.currentConcerns ?? ['dificuldade com controle de impulsos'],
          userNeeds: ['rede de apoio'],
          supportContext: 'none_reported',
          safetyState: 'needs_check',
          pendingQuestionCode: 'immediate_safety',
          lastAssistantIntent: 'check_immediate_safety'
        }
      };
    }

    if (onlyBbrain) {
      return {
        ...input.response,
        reply: replies.dependencyBoundary[language],
        riskLevel: input.response.riskLevel === 'high' ? 'high' : 'low',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: current?.currentTopic,
          currentConcerns: current?.currentConcerns ?? [],
          userNeeds: ['rede de apoio'],
          supportContext: 'none_reported',
          safetyState: current?.safetyState ?? 'none',
          pendingQuestionCode: 'human_support_available',
          lastAssistantIntent: 'check_human_support'
        }
      };
    }

    if (selfLabel && mentionsImpulse) {
      const currentConcerns = current?.currentConcerns ?? [];
      return {
        ...input.response,
        reply: replies.impulseSafety[language],
        riskLevel: input.response.riskLevel === 'high' ? 'high' : 'medium',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: current?.currentTopic ?? 'mudanças percebidas na rotina',
          currentConcerns: currentConcerns.some((concern) => IMPULSE_CONCERN.test(concern))
            ? currentConcerns
            : [...currentConcerns, 'controle de impulsos'].slice(0, 5),
          userNeeds: current?.userNeeds ?? [],
          supportContext: current?.supportContext ?? 'unknown',
          safetyState: 'needs_check',
          pendingQuestionCode: 'immediate_safety',
          lastAssistantIntent: 'check_immediate_safety'
        }
      };
    }

    if (selfLabel) {
      return {
        ...input.response,
        reply: replies.selfLabel[language],
        riskLevel: input.response.riskLevel === 'none' ? 'low' : input.response.riskLevel,
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: current?.currentTopic ?? 'mudanças percebidas na rotina',
          currentConcerns: current?.currentConcerns ?? [],
          userNeeds: current?.userNeeds ?? [],
          supportContext: current?.supportContext ?? 'unknown',
          safetyState: current?.safetyState ?? 'none',
          pendingQuestionCode: 'clarification',
          lastAssistantIntent: 'explore_impact'
        }
      };
    }

    if (
      current?.pendingQuestionCode === 'immediate_safety' &&
      NO_IMMEDIATE_RISK.test(input.currentUserMessage.trim())
    ) {
      return {
        ...input.response,
        reply: replies.humanSupportFollowup[language],
        riskLevel: input.response.riskLevel === 'high' ? 'high' : 'low',
        scopeStatus: 'in_scope',
        conversationStateUpdate: {
          shouldUpdate: true,
          currentTopic: current.currentTopic,
          currentConcerns: current.currentConcerns,
          userNeeds: current.userNeeds,
          supportContext: current.supportContext,
          safetyState: 'none',
          pendingQuestionCode: 'human_support_available',
          lastAssistantIntent: 'check_human_support'
        }
      };
    }

    if (PROHIBITED_REPLY.test(input.response.reply)) {
      return {
        ...input.response,
        reply: replies.corrective[language],
        riskLevel: input.response.riskLevel === 'none' ? 'low' : input.response.riskLevel,
        conversationStateUpdate: {
          shouldUpdate: false,
          currentConcerns: [],
          userNeeds: [],
          supportContext: 'unknown',
          safetyState: 'none',
          pendingQuestionCode: 'clarification',
          lastAssistantIntent: 'listen'
        }
      };
    }

    return input.response;
  }
}
