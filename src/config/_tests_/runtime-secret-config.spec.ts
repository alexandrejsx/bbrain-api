import config from '../../config';

const relevantKeys = [
  'NODE_ENV',
  'JWT_SECRET',
  'CONVERSATION_FINGERPRINT_SECRET',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'EMAIL_FROM'
] as const;

describe('runtime secret configuration', () => {
  const originalValues = Object.fromEntries(
    relevantKeys.map((key) => [key, process.env[key]])
  ) as Record<(typeof relevantKeys)[number], string | undefined>;

  afterEach(() => {
    for (const key of relevantKeys) {
      const original = originalValues[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it.each(['staging', 'production'])('fails startup in %s without JWT_SECRET', (environment) => {
    process.env.NODE_ENV = environment;
    process.env.CONVERSATION_FINGERPRINT_SECRET = 'synthetic-conversation-test-secret-value';
    delete process.env.JWT_SECRET;

    expect(() => config()).toThrow('JWT_SECRET is required');
  });

  it('uses an isolated fallback only in a local environment', () => {
    process.env.NODE_ENV = 'local';
    delete process.env.JWT_SECRET;

    expect(config().auth.jwtSecret).toBe('local-jwt-signing-secret');
  });

  it.each(['JWT_SECRET', 'CONVERSATION_FINGERPRINT_SECRET'])(
    'rejects a weak %s in a protected environment',
    (secretName) => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'synthetic-jwt-test-secret-value-long';
      process.env.CONVERSATION_FINGERPRINT_SECRET = 'synthetic-conversation-test-secret-value';
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'synthetic-email-provider-key';
      process.env.EMAIL_FROM = 'noreply@example.com';
      process.env[secretName] = 'too-short';

      expect(() => config()).toThrow('must contain at least 32 bytes');
    }
  );

  it.each(['staging', 'production'])(
    'fails startup in %s when transactional email delivery is not configured',
    (environment) => {
      process.env.NODE_ENV = environment;
      process.env.JWT_SECRET = 'synthetic-jwt-test-secret-value-long';
      process.env.CONVERSATION_FINGERPRINT_SECRET = 'synthetic-conversation-test-secret-value';
      delete process.env.EMAIL_PROVIDER;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;

      expect(() => config()).toThrow('EMAIL_PROVIDER=resend is required');
    }
  );
});
