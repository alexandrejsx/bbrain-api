interface MongoDBConfig {
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

interface BBrainModelConfig {
  chat: string;
  internal: string;
  observationExtraction: string;
  risk: string;
  escalation: string;
}

interface OpenAIConfig {
  apiKey: string;
  models: BBrainModelConfig;
  embeddingModel: string;
  timeoutMs: number;
}

interface GeminiConfig {
  apiKey: string;
  model: string;
  observationExtractionModel: string;
  timeoutMs: number;
}

interface StripePriceConfig {
  standardMonthlyBrl?: string;
  standardYearlyBrl?: string;
  proMonthlyBrl?: string;
  proYearlyBrl?: string;
  standardMonthlyUsd?: string;
  standardYearlyUsd?: string;
  proMonthlyUsd?: string;
  proYearlyUsd?: string;
}

interface BillingConfig {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  frontendUrl: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  stripePortalReturnUrl: string;
  asaasApiUrl: string;
  asaasApiKey?: string;
  asaasWebhookSecret?: string;
  asaasWebhookUrl: string;
  prices: StripePriceConfig;
}

interface AiConfig {
  chatProvider: 'gemini' | 'openai' | 'mock';
  observationExtraction: {
    enabled: boolean;
    persistEnabled: boolean;
    primaryProvider: 'gemini' | 'openai' | 'noop';
    fallbackProvider: 'gemini' | 'openai' | 'noop';
    minimumConfidence: number;
  };
}

interface CorsConfig {
  origins: string[];
}

interface ConversationConfig {
  stateTtlHours: number;
  exchangeLedgerTtlHours: number;
  exchangeProcessingLeaseSeconds: number;
  fingerprintSecret: string;
}

interface AppConfig {
  env: string;
  stage?: string;
  port: number;
  apiBaseUrl?: string;
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

const DEFAULT_BBRAIN_MODELS = {
  chat: 'gpt-5.4-mini',
  internal: 'gpt-5.4-nano',
  escalation: 'gpt-5.4'
} as const;

const parseEmailProvider = (value?: string): EmailConfig['provider'] => {
  return value === 'resend' ? 'resend' : 'log';
};

const parseChatProvider = (value?: string): AiConfig['chatProvider'] => {
  if (value === 'openai' || value === 'mock') {
    return value;
  }

  return 'gemini';
};

const parseObservationProvider = (
  value: string | undefined,
  fallback: AiConfig['observationExtraction']['primaryProvider']
): AiConfig['observationExtraction']['primaryProvider'] => {
  if (value === 'openai' || value === 'gemini' || value === 'noop') return value;
  return fallback;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const parseConfidence = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const resolveConversationFingerprintSecret = (): string => {
  const configured = process.env.CONVERSATION_FINGERPRINT_SECRET?.trim();
  if (configured) return configured;

  const environment = process.env.NODE_ENV || 'local';
  if (environment === 'production' || environment === 'staging') {
    throw new Error(
      'CONVERSATION_FINGERPRINT_SECRET is required outside local and test environments'
    );
  }

  return 'local-conversation-fingerprint-secret';
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

const parseBBrainModels = (): BBrainModelConfig => {
  const internal = process.env.OPENAI_INTERNAL_MODEL || DEFAULT_BBRAIN_MODELS.internal;

  return {
    chat: process.env.OPENAI_CHAT_MODEL || DEFAULT_BBRAIN_MODELS.chat,
    internal,
    observationExtraction:
      process.env.OPENAI_OBSERVATION_EXTRACTION_MODEL || DEFAULT_BBRAIN_MODELS.chat,
    risk: process.env.OPENAI_RISK_MODEL || internal,
    escalation: process.env.OPENAI_ESCALATION_MODEL || DEFAULT_BBRAIN_MODELS.escalation
  };
};

const config = (): AppConfig => ({
  env: process.env.NODE_ENV || 'local',
  stage: process.env.APP_STAGE,
  port: Number(process.env.PORT || 9090),
  apiBaseUrl: process.env.API_BASE_URL,
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGINS)
  },
  conversation: {
    stateTtlHours: parsePositiveNumber(process.env.CONVERSATION_STATE_TTL_HOURS, 24),
    exchangeLedgerTtlHours: parsePositiveNumber(
      process.env.CONVERSATION_EXCHANGE_LEDGER_TTL_HOURS,
      24
    ),
    exchangeProcessingLeaseSeconds: parsePositiveNumber(
      process.env.CONVERSATION_EXCHANGE_PROCESSING_LEASE_SECONDS,
      120
    ),
    fingerprintSecret: resolveConversationFingerprintSecret()
  },
  mongoDb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DATABASE_NAME || 'mental-companion'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'local-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    passwordResetCodeTtlMinutes: Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES || 15),
    accountDeletionGraceDays: Number(process.env.ACCOUNT_DELETION_GRACE_DAYS || 7),
    accountDeletionSweepIntervalMs: Number(
      process.env.ACCOUNT_DELETION_SWEEP_INTERVAL_MS || 60 * 60 * 1000
    )
  },
  email: {
    provider: parseEmailProvider(process.env.EMAIL_PROVIDER),
    fromEmail: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME || 'BBrain',
    resendApiKey: process.env.RESEND_API_KEY
  },
  ai: {
    chatProvider: parseChatProvider(process.env.AI_CHAT_PROVIDER),
    observationExtraction: {
      enabled: parseBoolean(process.env.AI_OBSERVATION_EXTRACTION_ENABLED),
      persistEnabled: parseBoolean(process.env.AI_OBSERVATION_EXTRACTION_PERSIST_ENABLED),
      primaryProvider: parseObservationProvider(
        process.env.AI_OBSERVATION_EXTRACTION_PROVIDER,
        'gemini'
      ),
      fallbackProvider: parseObservationProvider(
        process.env.AI_OBSERVATION_EXTRACTION_FALLBACK_PROVIDER,
        'noop'
      ),
      minimumConfidence: parseConfidence(process.env.AI_OBSERVATION_EXTRACTION_MIN_CONFIDENCE, 0.85)
    }
  },
  openAi: {
    apiKey: process.env.OPENAI_API_KEY || '',
    models: parseBBrainModels(),
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 30_000)
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    observationExtractionModel:
      process.env.GEMINI_OBSERVATION_EXTRACTION_MODEL ||
      process.env.GEMINI_MODEL ||
      'gemini-3.5-flash',
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 60_000)
  },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    checkoutSuccessUrl:
      process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/checkout/sucesso',
    checkoutCancelUrl:
      process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/checkout/cancelado',
    stripePortalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || 'http://localhost:3000/perfil',
    asaasApiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com.br',
    asaasApiKey: process.env.ASAAS_API_KEY,
    asaasWebhookSecret: process.env.ASAAS_WEBHOOK_SECRET,
    asaasWebhookUrl: process.env.ASAAS_WEBHOOK_URL || 'http://localhost:9090/webhooks/asaas',
    prices: {
      standardMonthlyBrl: process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL,
      standardYearlyBrl: process.env.STRIPE_PRICE_STANDARD_YEARLY_BRL,
      proMonthlyBrl: process.env.STRIPE_PRICE_PRO_MONTHLY_BRL,
      proYearlyBrl: process.env.STRIPE_PRICE_PRO_YEARLY_BRL,
      standardMonthlyUsd: process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD,
      standardYearlyUsd: process.env.STRIPE_PRICE_STANDARD_YEARLY_USD,
      proMonthlyUsd: process.env.STRIPE_PRICE_PRO_MONTHLY_USD,
      proYearlyUsd: process.env.STRIPE_PRICE_PRO_YEARLY_USD
    }
  }
});

export default config;
