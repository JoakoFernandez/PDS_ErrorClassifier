import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  openai: z.object({
    apiKey: z.string().min(1).optional(),
    baseURL: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
    maxTokens: z.coerce.number().default(500),
    temperature: z.coerce.number().min(0).max(2).default(0.2),
  }),

  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
    password: z.string().optional(),
    ttlSeconds: z.coerce.number().default(3600),
    keyPrefix: z.string().default('pds:error:'),
  }),

  classification: z.object({
    aiFallbackEnabled: z.coerce.boolean().default(true),
    aiConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.6),
  }),

  rateLimit: z.object({
    windowMs: z.coerce.number().default(60_000),
    maxRequests: z.coerce.number().default(100),
  }),

  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
  }),
}).superRefine((data, ctx) => {
  if (data.classification.aiFallbackEnabled && !data.openai.apiKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OPENAI_API_KEY is required when AI_FALLBACK_ENABLED is true. Set AI_FALLBACK_ENABLED=false to use static map only.',
      path: ['openai', 'apiKey'],
    });
  }
});

const parseResult = configSchema.safeParse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL,
    maxTokens: process.env.OPENAI_MAX_TOKENS,
    temperature: process.env.OPENAI_TEMPERATURE,
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    ttlSeconds: process.env.REDIS_TTL_SECONDS,
    keyPrefix: process.env.REDIS_KEY_PREFIX,
  },
  classification: {
    aiFallbackEnabled: process.env.AI_FALLBACK_ENABLED,
    aiConfidenceThreshold: process.env.AI_CONFIDENCE_THRESHOLD,
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: process.env.LOG_LEVEL,
    format: process.env.LOG_FORMAT,
  },
});

if (!parseResult.success) {
  console.error('Invalid configuration:', parseResult.error.flatten());
  process.exit(1);
}

export const config = parseResult.data;
export type Config = typeof config;
