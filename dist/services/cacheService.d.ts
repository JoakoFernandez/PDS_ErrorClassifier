/**
 * @file services/cacheService.ts
 * @description Redis-backed cache for error classifications.
 *
 * Why Redis:
 * ──────────
 * Payment systems under load can see thousands of identical "card_declined"
 * errors per second. Caching classifications in Redis means:
 *   • The OpenAI API is called once per unique error code, not once per event.
 *   • p99 latency for cached lookups is < 2 ms vs ~400-800 ms for AI calls.
 *   • Costs drop dramatically — a Redis hit is ~$0.000001 vs ~$0.001 for GPT.
 *
 * Cache key strategy:
 * ──────────────────
 * Key = `{prefix}{normalised_code}` (e.g. `pds:error:CARD_DECLINED`).
 * We intentionally do NOT include rawMessage or context in the key because:
 *   1. The user-facing message for a given error code rarely varies.
 *   2. Including message text would create near-infinite unique keys.
 * If you need context-sensitive messages, consider a secondary key scheme.
 *
 * Graceful degradation:
 * ─────────────────────
 * All methods catch Redis errors and return null/false rather than throwing.
 * This ensures a Redis outage downgrades to AI-only classification, not a 500.
 */
import type { ClassifiedError } from '../types';
declare class CacheService {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    /** Build namespaced cache key from a normalised error code. */
    private buildKey;
    /**
     * Retrieve a cached classification. Returns null on miss or Redis failure.
     * Also increments the hit counter (fire-and-forget) for analytics.
     */
    get(errorCode: string): Promise<ClassifiedError | null>;
    /**
     * Store a classification in Redis with the configured TTL.
     * Failures are silently swallowed — a cache write failure is non-fatal.
     */
    set(errorCode: string, classification: ClassifiedError): Promise<boolean>;
    /**
     * Invalidate a specific error code's cache entry.
     * Useful for hot-patching a bad classification without redeploying.
     */
    invalidate(errorCode: string): Promise<boolean>;
    /** Health check — ping Redis and return latency in ms. */
    ping(): Promise<{
        healthy: boolean;
        latencyMs?: number;
    }>;
}
export declare const cacheService: CacheService;
export {};
//# sourceMappingURL=cacheService.d.ts.map