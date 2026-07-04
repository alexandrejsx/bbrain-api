import { ConversationReplyCatalog } from '../../../use-cases/conversation/conversation-reply-catalog';

describe('ConversationReplyCatalog', () => {
  const catalog = new ConversationReplyCatalog();

  it('returns profile setup replies in the supported languages', () => {
    expect(catalog.getProfileSetupReply('pt-BR')).toContain('Vamos configurar seu perfil?');
    expect(catalog.getProfileSetupReply('en-US')).toContain('Shall we set up your profile?');
    expect(catalog.getProfileSetupReply('es-ES')).toContain('¿Configuramos tu perfil?');
  });

  it('falls back to pt-BR when the language is unsupported', () => {
    expect(catalog.getProfileSetupReply('fr-FR')).toContain('Vamos configurar seu perfil?');
  });
});
