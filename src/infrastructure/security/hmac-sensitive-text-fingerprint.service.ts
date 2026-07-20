import { createHmac } from 'node:crypto';
import {
  SensitiveTextFingerprintInput,
  SensitiveTextFingerprintPort
} from '../../use-cases/conversation/ports/sensitive-text-fingerprint.port';

export class HmacSensitiveTextFingerprintService implements SensitiveTextFingerprintPort {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('Conversation fingerprint secret is required');
  }

  fingerprint(input: SensitiveTextFingerprintInput): string {
    const values = [
      input.purpose,
      input.userId,
      input.conversationId,
      input.sourceMessageId,
      input.text
    ];
    const canonical = values
      .map((value) => `${Buffer.byteLength(value, 'utf8')}:${value}`)
      .join('|');
    return createHmac('sha256', this.secret).update(canonical, 'utf8').digest('hex');
  }
}
