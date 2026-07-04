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
  risk: string;
  escalation: string;
}

interface OpenAIConfig {
  apiKey: string;
  models: BBrainModelConfig;
  embeddingModel: string;
}

interface GeminiConfig {
  apiKey: string;
  model: string;
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
}

interface CorsConfig {
  origins: string[];
}

interface AppConfig {
  env: string;
  stage?: string;
  port: number;
  apiBaseUrl?: string;
  cors: CorsConfig;
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
    chatProvider: parseChatProvider(process.env.AI_CHAT_PROVIDER)
  },
  openAi: {
    apiKey: process.env.OPENAI_API_KEY || '',
    models: parseBBrainModels(),
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
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
