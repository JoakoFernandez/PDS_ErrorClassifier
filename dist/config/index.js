"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const configSchema = zod_1.z.object({
    port: zod_1.z.coerce.number().default(3000),
    nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    openai: zod_1.z.object({
        apiKey: zod_1.z.string().min(1).optional(),
        baseURL: zod_1.z.string().optional(),
        model: zod_1.z.string().default('gpt-4o-mini'),
        maxTokens: zod_1.z.coerce.number().default(500),
        temperature: zod_1.z.coerce.number().min(0).max(2).default(0.2),
    }),
    redis: zod_1.z.object({
        url: zod_1.z.string().default('redis://localhost:6379'),
        password: zod_1.z.string().optional(),
        ttlSeconds: zod_1.z.coerce.number().default(3600),
        keyPrefix: zod_1.z.string().default('pds:error:'),
    }),
    classification: zod_1.z.object({
        aiFallbackEnabled: zod_1.z.coerce.boolean().default(true),
        aiConfidenceThreshold: zod_1.z.coerce.number().min(0).max(1).default(0.6),
    }),
    rateLimit: zod_1.z.object({
        windowMs: zod_1.z.coerce.number().default(60000),
        maxRequests: zod_1.z.coerce.number().default(100),
    }),
    logging: zod_1.z.object({
        level: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        format: zod_1.z.enum(['json', 'pretty']).default('json'),
    }),
}).superRefine((data, ctx) => {
    if (data.classification.aiFallbackEnabled && !data.openai.apiKey) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
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
exports.config = parseResult.data;
//# sourceMappingURL=index.js.map