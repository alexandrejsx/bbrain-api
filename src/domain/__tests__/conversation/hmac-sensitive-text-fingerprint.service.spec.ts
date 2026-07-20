import { HmacSensitiveTextFingerprintService } from '../../../infrastructure/security/hmac-sensitive-text-fingerprint.service';

describe('HmacSensitiveTextFingerprintService', () => {
  it('is deterministic while separating purpose and source ownership', () => {
    const service = new HmacSensitiveTextFingerprintService('test-secret');
    const base = {
      userId: 'user-id',
      conversationId: 'conversation-id',
      sourceMessageId: 'message-id',
      text: 'mensagem sensível'
    };

    const request = service.fingerprint({ ...base, purpose: 'conversation_request' });
    const repeated = service.fingerprint({ ...base, purpose: 'conversation_request' });
    const evidence = service.fingerprint({ ...base, purpose: 'wellbeing_evidence' });

    expect(request).toMatch(/^[a-f0-9]{64}$/u);
    expect(repeated).toBe(request);
    expect(evidence).not.toBe(request);
    expect(request).not.toContain(base.text);
  });
});
