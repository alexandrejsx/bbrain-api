import { ConversationLanguageService } from '../../../use-cases/conversation/conversation-language.service';

describe('ConversationLanguageService', () => {
  const service = new ConversationLanguageService();

  it('resolves the profile language before acceptedLanguage', () => {
    expect(service.resolvePreferredLanguage('en-US', 'es-ES,pt-BR;q=0.8')).toBe('en-US');
  });

  it('uses acceptedLanguage when the profile does not define a language', () => {
    expect(service.resolvePreferredLanguage(undefined, 'es-ES,pt-BR;q=0.8')).toBe('es-ES');
  });

  it('falls back to pt-BR when no supported language is available', () => {
    expect(service.resolvePreferredLanguage(undefined, 'fr-FR')).toBe('pt-BR');
  });

  it('keeps responseLanguage as pt-BR when the profile is pt-BR', () => {
    expect(service.resolve('pt-BR', 'en-US,en;q=0.9')).toEqual({
      preferredLanguage: 'pt-BR',
      responseLanguage: 'pt-BR'
    });
  });

  it('keeps responseLanguage as en-US when the profile is en-US', () => {
    expect(service.resolve('en-US', 'pt-BR,pt;q=0.9')).toEqual({
      preferredLanguage: 'en-US',
      responseLanguage: 'en-US'
    });
  });

  it('keeps responseLanguage as es-ES when the profile is es-ES', () => {
    expect(service.resolve('es-ES', 'en-US,en;q=0.9')).toEqual({
      preferredLanguage: 'es-ES',
      responseLanguage: 'es-ES'
    });
  });

  it('uses acceptedLanguage when the profile language is missing', () => {
    expect(service.resolve(undefined, 'en-US,en;q=0.9')).toEqual({
      preferredLanguage: 'en-US',
      responseLanguage: 'en-US'
    });
  });

  it('falls back to pt-BR when neither profile language nor acceptedLanguage is supported', () => {
    expect(service.resolve(undefined, undefined)).toEqual({
      preferredLanguage: 'pt-BR',
      responseLanguage: 'pt-BR'
    });
  });
});
