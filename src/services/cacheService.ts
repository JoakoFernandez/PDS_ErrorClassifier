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

import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { CacheEntry, ClassifiedError } from '../types';

class CacheService {
  private client: Redis;
  private isConnected = false;

  constructor() {
    this.client = new Redis(config.redis.url, {
      password: config.redis.password || undefined,
      lazyConnect: true,
      enableOfflineQueue: false, // Don't queue commands when disconnected
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 100, 3000);
      },
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.warn('Redis connection error — falling back to AI classification', { error: err.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      logger.warn('Could not connect to Redis on startup', { error: (err as Error).message });
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /** Build namespaced cache key from a normalised error code. */
  private buildKey(errorCode: string): string {
    return `${config.redis.keyPrefix}${errorCode.toUpperCase()}`;
  }

  /**
   * Retrieve a cached classification. Returns null on miss or Redis failure.
   * Also increments the hit counter (fire-and-forget) for analytics.
   */
  async get(errorCode: string): Promise<ClassifiedError | null> {
    if (!this.isConnected) return null;

    try {
      const key = this.buildKey(errorCode);
      const raw = await this.client.get(key);
      if (!raw) return null;

      const entry: CacheEntry = JSON.parse(raw);

      // Increment hit counter asynchronously — don't await to avoid latency
      this.client.hincrby(`${key}:stats`, 'hits', 1).catch(() => {});

      logger.debug('Cache hit', { errorCode, cachedAt: entry.cachedAt });
      return entry.classification;
    } catch (err) {
      logger.warn('Cache read error', { errorCode, error: (err as Error).message });
      return null;
    }
  }

  /**
   * Store a classification in Redis with the configured TTL.
   * Failures are silently swallowed — a cache write failure is non-fatal.
   */
  async set(errorCode: string, classification: ClassifiedError): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const key = this.buildKey(errorCode);
      const entry: CacheEntry = {
        classification,
        cachedAt: new Date().toISOString(),
        hitCount: 0,
      };

      await this.client.setex(key, config.redis.ttlSeconds, JSON.stringify(entry));
      logger.debug('Cached classification', { errorCode, ttl: config.redis.ttlSeconds });
      return true;
    } catch (err) {
      logger.warn('Cache write error', { errorCode, error: (err as Error).message });
      return false;
    }
  }

  /**
   * Invalidate a specific error code's cache entry.
   * Useful for hot-patching a bad classification without redeploying.
   */
  async invalidate(errorCode: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const key = this.buildKey(errorCode);
      await this.client.del(key);
      logger.info('Cache invalidated', { errorCode });
      return true;
    } catch (err) {
      logger.warn('Cache invalidation error', { errorCode, error: (err as Error).message });
      return false;
    }
  }

  /** Health check — ping Redis and return latency in ms. */
  async ping(): Promise<{ healthy: boolean; latencyMs?: number }> {
    if (!this.isConnected) return { healthy: false };

    try {
      const start = Date.now();
      await this.client.ping();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false };
    }
  }
}

export const cacheService = new CacheService();
