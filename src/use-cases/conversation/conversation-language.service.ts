export type SupportedConversationLanguage = 'pt-BR' | 'en-US' | 'es-ES';

export interface ResolvedConversationLanguage {
  preferredLanguage: SupportedConversationLanguage;
  responseLanguage: SupportedConversationLanguage;
}

export function normalizeConversationLanguage(
  value?: string
): SupportedConversationLanguage | undefined {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return undefined;
  if (normalized.startsWith('en')) return 'en-US';
  if (normalized.startsWith('es')) return 'es-ES';
  if (normalized.startsWith('pt')) return 'pt-BR';
  return undefined;
}

export class ConversationLanguageService {
  resolvePreferredLanguage(
    profileLanguage?: string,
    acceptedLanguage?: string
  ): SupportedConversationLanguage {
    return (
      normalizeConversationLanguage(profileLanguage) ??
      this.normalizeAcceptLanguage(acceptedLanguage) ??
      'pt-BR'
    );
  }

  resolve(profileLanguage?: string, acceptedLanguage?: string): ResolvedConversationLanguage {
    const preferredLanguage = this.resolvePreferredLanguage(profileLanguage, acceptedLanguage);

    return {
      preferredLanguage,
      responseLanguage: preferredLanguage
    };
  }

  private normalizeAcceptLanguage(value?: string): SupportedConversationLanguage | undefined {
    const firstLanguage = value?.split(',')[0]?.trim();
    return normalizeConversationLanguage(firstLanguage);
  }
}
