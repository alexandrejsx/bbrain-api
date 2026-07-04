import {
  normalizeConversationLanguage,
  SupportedConversationLanguage
} from './conversation-language.service';

const PROFILE_SETUP_REPLIES: Record<SupportedConversationLanguage, string> = {
  'pt-BR':
    'Antes de continuarmos, quero conhecer um pouco melhor você para que o BBrain possa te acompanhar com mais cuidado. Vamos configurar seu perfil?',
  'en-US':
    'Before we continue, I would like to get to know you a little better so BBrain can support you with more care. Shall we set up your profile?',
  'es-ES':
    'Antes de continuar, me gustaría conocerte un poco mejor para que BBrain pueda acompañarte con más cuidado. ¿Configuramos tu perfil?'
};

export class ConversationReplyCatalog {
  getProfileSetupReply(language?: string): string {
    return PROFILE_SETUP_REPLIES[this.resolveLanguage(language)];
  }

  private resolveLanguage(language?: string): SupportedConversationLanguage {
    return normalizeConversationLanguage(language) ?? 'pt-BR';
  }
}
