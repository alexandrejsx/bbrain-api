import { ReflectiveProfileUpdate } from '../entities/reflective-profile.entity';

export type ConversationScopeStatus = 'in_scope' | 'out_of_scope';

const OUT_OF_SCOPE_REPLIES = {
  'pt-BR':
    'Eu não consigo ajudar com esse tipo de pedido aqui. O BBrain é voltado para apoio emocional, reflexão, rotina, sono, humor e autoconhecimento.',
  'en-US':
    'I cannot help with that kind of request here. BBrain is focused on emotional support, reflection, routine, sleep, mood, and self-knowledge.',
  'es-ES':
    'No puedo ayudar con ese tipo de pedido aquí. BBrain está orientado al apoyo emocional, la reflexión, la rutina, el sueño, el estado de ánimo y el autoconocimiento.'
} as const;

type SupportedReplyLanguage = keyof typeof OUT_OF_SCOPE_REPLIES;

function normalizeReplyLanguage(language?: string): SupportedReplyLanguage {
  const normalized = language?.trim().toLowerCase();

  if (normalized?.startsWith('en')) return 'en-US';
  if (normalized?.startsWith('es')) return 'es-ES';
  return 'pt-BR';
}

export class ConversationScopePolicy {
  resolveReply(
    scopeStatus: ConversationScopeStatus,
    agentReply: string,
    language?: string
  ): string {
    return scopeStatus === 'out_of_scope'
      ? OUT_OF_SCOPE_REPLIES[normalizeReplyLanguage(language)]
      : agentReply;
  }

  resolveProfileUpdate(
    scopeStatus: ConversationScopeStatus,
    update: ReflectiveProfileUpdate
  ): ReflectiveProfileUpdate | undefined {
    if (scopeStatus === 'in_scope') {
      return update;
    }

    if (update.boundariesToAdd?.length) {
      return { boundariesToAdd: update.boundariesToAdd };
    }

    return undefined;
  }
}
