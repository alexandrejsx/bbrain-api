export interface SensitiveTextFingerprintInput {
  purpose: 'conversation_request' | 'wellbeing_evidence';
  userId: string;
  conversationId: string;
  sourceMessageId: string;
  text: string;
}

export interface SensitiveTextFingerprintPort {
  fingerprint(input: SensitiveTextFingerprintInput): string;
}
