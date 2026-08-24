export interface MongoDBConfig {
  uri: string;
  dbName: string;
}

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordResetCodeTtlMinutes: number;
  accountDeletionGraceDays: number;
  accountDeletionSweepIntervalMs: number;
}

interface EmailConfig {
  provider: 'log' | 'resend';
  fromEmail?: string;
  fromName: string;
  resendApiKey?: string;
}

interface ModelRoleConfig {
  fast: string;
  conversation: string;
  reasoning: string;
}

interface OpenAIConfig {
  apiKey: string;
  models: ModelRoleConfig;
  timeoutMs: number;
}

interface GeminiConfig {
  apiKey: string;
  models: ModelRoleConfig;
  timeoutMs: number;
}

interface BillingConfig {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  stripePortalReturnUrl: string;
  asaasApiUrl: string;
  asaasApiKey?: string;
  asaasWebhookSecret?: string;
}

interface AiConfig {
  provider: 'gemini' | 'openai';
  extractionMinimumConfidence: number;
  maxRetries: number;
}

interface CorsConfig {
  origins: string[];
}

interface ConversationConfig {
  stateTtlHours: number;
  recentMessageLimit: number;
  exchangeLedgerTtlHours: number;
  fingerprintSecret: string;
}

interface AppConfig {
  port: number;
  cors: CorsConfig;
  conversation: ConversationConfig;
  mongoDb: MongoDBConfig;
  auth: AuthConfig;
  email: EmailConfig;
  ai: AiConfig;
  openAi: OpenAIConfig;
  gemini: GeminiConfig;
  billing: BillingConfig;
}

const DEFAULT_OPENAI_MODELS: ModelRoleConfig = {
  fast: 'gpt-5.4-nano',
  conversation: 'gpt-5.4-mini',
  reasoning: 'gpt-5.4'
};

const DEFAULT_GEMINI_MODELS: ModelRoleConfig = {
  fast: 'gemini-3.5-flash',
  conversation: 'gemini-3.5-flash',
  reasoning: 'gemini-3.1-pro-preview'
};

const resolveEmailConfig = (): EmailConfig => {
  const environment = process.env.NODE_ENV || 'local';
  const protectedEnvironment = environment === 'production' || environment === 'staging';
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim();
  const provider = configuredProvider === 'resend' ? 'resend' : 'log';
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM?.trim();

  if (protectedEnvironment) {
    if (configuredProvider !== 'resend') {
      throw new Error('EMAIL_PROVIDER=resend is required in staging and production environments');
    }

    if (!resendApiKey || !fromEmail) {
      throw new Error(
        'RESEND_API_KEY and EMAIL_FROM are required in staging and production environments'
      );
    }
  }

  return {
    provider,
    fromEmail,
    fromName: process.env.EMAIL_FROM_NAME || 'BBrain',
    resendApiKey
  };
};

const parseAiProvider = (value?: string): AiConfig['provider'] => {
  if (!value?.trim()) return 'gemini';
  if (value === 'openai' || value === 'gemini') return value;
  throw new Error('AI_PROVIDER must be openai or gemini');
};

const parseRetryCount = (value?: string): number => {
  if (!value?.trim()) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2) {
    throw new Error('AI_MAX_RETRIES must be an integer between 0 and 2');
  }
  return parsed;
};

const parseConfidence = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isProtectedEnvironment = (environment: string): boolean =>
  environment === 'production' || environment === 'staging';

const validateProtectedSecret = (name: string, value: string, environment: string): string => {
  if (isProtectedEnvironment(environment) && Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${name} must contain at least 32 bytes in staging and production`);
  }
  return value;
};

const resolveConversationFingerprintSecret = (): string => {
  const configured = process.env.CONVERSATION_FINGERPRINT_SECRET?.trim();
  const environment = process.env.NODE_ENV || 'local';
  if (configured) {
    return validateProtectedSecret('CONVERSATION_FINGERPRINT_SECRET', configured, environment);
  }

  if (isProtectedEnvironment(environment)) {
    throw new Error(
      'CONVERSATION_FINGERPRINT_SECRET is required outside local and test environments'
    );
  }

  return 'local-conversation-fingerprint-secret';
};

const resolveJwtSecret = (): string => {
  const configured = process.env.JWT_SECRET?.trim();
  const environment = process.env.NODE_ENV || 'local';
  if (configured) return validateProtectedSecret('JWT_SECRET', configured, environment);

  if (isProtectedEnvironment(environment)) {
    throw new Error('JWT_SECRET is required in staging and production environments');
  }

  return 'local-jwt-signing-secret';
};

const parseCorsOrigins = (value?: string): string[] => {
  if (!value) {
    return ['http://localhost:3000'];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseModels = (prefix: 'OPENAI' | 'GEMINI', defaults: ModelRoleConfig): ModelRoleConfig => {
  return {
    fast: process.env[`${prefix}_MODEL_FAST`] || defaults.fast,
    conversation: process.env[`${prefix}_MODEL_CONVERSATION`] || defaults.conversation,
    reasoning: process.env[`${prefix}_MODEL_REASONING`] || defaults.reasoning
  };
};

export const resolveMongoDbConfig = (): MongoDBConfig => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DATABASE_NAME || 'bbrain'
});

const config = (): AppConfig => ({
  port: Number(process.env.PORT || 9090),
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGINS)
  },
  conversation: {
    stateTtlHours: parsePositiveNumber(process.env.CONVERSATION_STATE_TTL_HOURS, 24),
    recentMessageLimit: Math.min(
      8,
      Math.max(2, Math.floor(parsePositiveNumber(process.env.CONVERSATION_RECENT_MESSAGE_LIMIT, 6)))
    ),
    exchangeLedgerTtlHours: parsePositiveNumber(
      process.env.CONVERSATION_EXCHANGE_LEDGER_TTL_HOURS,
      24
    ),
    fingerprintSecret: resolveConversationFingerprintSecret()
  },
  mongoDb: resolveMongoDbConfig(),
  auth: {
    jwtSecret: resolveJwtSecret(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    passwordResetCodeTtlMinutes: Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES || 15),
    accountDeletionGraceDays: Number(process.env.ACCOUNT_DELETION_GRACE_DAYS || 7),
    accountDeletionSweepIntervalMs: Number(
      process.env.ACCOUNT_DELETION_SWEEP_INTERVAL_MS || 60 * 60 * 1000
    )
  },
  email: resolveEmailConfig(),
  ai: {
    provider: parseAiProvider(process.env.AI_PROVIDER),
    extractionMinimumConfidence: parseConfidence(process.env.AI_EXTRACTION_MIN_CONFIDENCE, 0.85),
    maxRetries: parseRetryCount(process.env.AI_MAX_RETRIES)
  },
  openAi: {
    apiKey: process.env.OPENAI_API_KEY || '',
    models: parseModels('OPENAI', DEFAULT_OPENAI_MODELS),
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 30_000)
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    models: parseModels('GEMINI', DEFAULT_GEMINI_MODELS),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 60_000)
  },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    checkoutSuccessUrl:
      process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/checkout/sucesso',
    checkoutCancelUrl:
      process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/checkout/cancelado',
    stripePortalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/perfil',
    asaasApiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com.br',
    asaasApiKey: process.env.ASAAS_API_KEY,
    asaasWebhookSecret: process.env.ASAAS_WEBHOOK_SECRET
  }
});

export default config;
