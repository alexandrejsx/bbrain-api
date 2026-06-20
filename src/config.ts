interface MongoDBConfig {
  uri: string;
  dbName: string;
}

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
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

interface QueueConfig {
  provider: 'memory' | 'bullmq' | 'inngest';
  redisUrl?: string;
}

interface StorageConfig {
  type: 'local' | 's3';
  bucketName?: string;
  defaultRegion?: string;
  baseUrl?: string;
}

interface ObservabilityConfig {
  sentryDsn?: string;
  langfusePublicKey?: string;
  langfuseSecretKey?: string;
  langfuseBaseUrl?: string;
}

interface AgentConfig {
  enabled: boolean;
  tracingEnabled: boolean;
  maxToolCalls: number;
  defaultTemperature: number;
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
  openAi: OpenAIConfig;
  gemini: GeminiConfig;
  queue: QueueConfig;
  storage: StorageConfig;
  observability: ObservabilityConfig;
  agent: AgentConfig;
}

const DEFAULT_BBRAIN_MODELS = {
  chat: 'gpt-5.4-mini',
  internal: 'gpt-5.4-nano',
  escalation: 'gpt-5.4'
} as const;

const parseQueueProvider = (value?: string): QueueConfig['provider'] => {
  if (value === 'bullmq' || value === 'inngest') {
    return value;
  }

  return 'memory';
};

const parseStorageType = (value?: string): StorageConfig['type'] => {
  return value === 's3' ? 's3' : 'local';
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
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
  queue: {
    provider: parseQueueProvider(process.env.QUEUE_PROVIDER),
    redisUrl: process.env.REDIS_URL
  },
  storage: {
    type: parseStorageType(process.env.STORAGE_TYPE),
    bucketName: process.env.STORAGE_BUCKET_NAME,
    defaultRegion: process.env.STORAGE_DEFAULT_REGION,
    baseUrl: process.env.STORAGE_BASE_URL
  },
  observability: {
    sentryDsn: process.env.SENTRY_DSN,
    langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY,
    langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY,
    langfuseBaseUrl: process.env.LANGFUSE_BASE_URL
  },
  agent: {
    enabled: process.env.AGENT_ENABLED !== 'false',
    tracingEnabled: process.env.AGENT_TRACING_ENABLED === 'true',
    maxToolCalls: Number(process.env.AGENT_MAX_TOOL_CALLS || 8),
    defaultTemperature: Number(process.env.AGENT_DEFAULT_TEMPERATURE || 0.4)
  }
});

export default config;
