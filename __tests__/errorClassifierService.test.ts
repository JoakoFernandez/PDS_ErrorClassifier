/**
 * @file __tests__/errorClassifierService.test.ts
 * @description Unit tests for the 4-layer classification pipeline.
 *
 * Mocking strategy:
 * • cacheService and openaiService are mocked at the module level so tests
 *   don't require a running Redis or OpenAI key.
 * • Each test resets mocks to avoid cross-test state pollution.
 */

import { classifyError } from '../src/services/errorClassifierService';

// Mock dependencies
jest.mock('../src/services/cacheService', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../src/services/openaiService', () => ({
  classifyWithAI: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn() }),
}));

import { cacheService } from '../src/services/cacheService';
import { classifyWithAI } from '../src/services/openaiService';

const mockCache = cacheService as jest.Mocked<typeof cacheService>;
const mockAI = classifyWithAI as jest.MockedFunction<typeof classifyWithAI>;

describe('errorClassifierService', () => {
  const REQUEST_ID = 'test-request-001';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(true);
    mockAI.mockResolvedValue(null);
  });

  // ── Layer 1: Static Map ──────────────────────────────────────────────────

  describe('Layer 1 — Static Map', () => {
    it('resolves known error code from static map without hitting cache or AI', async () => {
      const result = await classifyError({ errorCode: '504' }, REQUEST_ID);

      expect(result.source).toBe('static_map');
      expect(result.confidence).toBe(1.0);
      expect(result.category).toBe('timeout');
      expect(result.severity).toBe('high');
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockAI).not.toHaveBeenCalled();
    });

    it('is case-insensitive for error code lookup', async () => {
      const result = await classifyError({ errorCode: 'card_declined' }, REQUEST_ID);
      expect(result.source).toBe('static_map');
      expect(result.category).toBe('payment_method');
    });

    it('trims whitespace from error codes', async () => {
      const result = await classifyError({ errorCode: '  INSUFFICIENT_FUNDS  ' }, REQUEST_ID);
      expect(result.source).toBe('static_map');
    });

    it('sets shouldEscalateToSupport=true for FRAUD_SUSPECTED', async () => {
      const result = await classifyError({ errorCode: 'FRAUD_SUSPECTED' }, REQUEST_ID);
      expect(result.shouldEscalateToSupport).toBe(true);
      expect(result.severity).toBe('critical');
    });
  });

  // ── Layer 2: Redis Cache ─────────────────────────────────────────────────

  describe('Layer 2 — Redis Cache', () => {
    it('returns cached result for unknown codes', async () => {
      const cachedClassification = {
        originalCode: 'UNKNOWN_ERROR_XYZ',
        userTitle: 'Cached title',
        userMessage: 'Cached message',
        suggestedActions: [],
        severity: 'medium' as const,
        category: 'unknown' as const,
        shouldEscalateToSupport: false,
        supportReferenceCode: 'PDS-CACHED01',
        classifiedAt: '2024-01-01T00:00:00Z',
        source: 'ai_classification' as const,
        confidence: 0.9,
      };

      mockCache.get.mockResolvedValue(cachedClassification);

      const result = await classifyError({ errorCode: 'UNKNOWN_ERROR_XYZ' }, REQUEST_ID);

      expect(result.source).toBe('redis_cache');
      expect(result.userTitle).toBe('Cached title');
      expect(mockAI).not.toHaveBeenCalled();
    });
  });

  // ── Layer 3: AI Classification ───────────────────────────────────────────

  describe('Layer 3 — AI Classification', () => {
    it('calls AI for truly unknown codes and caches the result', async () => {
      const aiResponse = {
        userTitle: 'AI classified title',
        userMessage: 'Your payment could not be processed due to an unusual error.',
        suggestedActions: [{ label: 'Try Again', description: 'Please retry.' }],
        severity: 'medium' as const,
        category: 'unknown' as const,
        shouldEscalateToSupport: false,
        confidence: 0.85,
      };

      mockAI.mockResolvedValue(aiResponse);

      const result = await classifyError({ errorCode: 'BRAND_NEW_ERROR_CODE' }, REQUEST_ID);

      expect(result.source).toBe('ai_classification');
      expect(result.confidence).toBe(0.85);
      expect(mockCache.set).toHaveBeenCalledWith('BRAND_NEW_ERROR_CODE', expect.objectContaining({
        source: 'ai_classification',
      }));
    });
  });

  // ── Layer 4: Fallback ────────────────────────────────────────────────────

  describe('Layer 4 — Fallback', () => {
    it('returns generic safe message when all layers fail', async () => {
      mockAI.mockResolvedValue(null);

      const result = await classifyError({ errorCode: 'TOTAL_MYSTERY_ERROR' }, REQUEST_ID);

      expect(result.source).toBe('fallback');
      expect(result.confidence).toBe(0);
      expect(result.shouldEscalateToSupport).toBe(false);
      expect(result.userTitle).toBe('Payment could not be completed');
    });
  });

  // ── Response Shape ───────────────────────────────────────────────────────

  describe('Response shape', () => {
    it('always includes a supportReferenceCode', async () => {
      const result = await classifyError({ errorCode: '504' }, REQUEST_ID);
      expect(result.supportReferenceCode).toMatch(/^PDS-[A-F0-9]{8}$/);
    });

    it('always includes a classifiedAt ISO timestamp', async () => {
      const result = await classifyError({ errorCode: 'CARD_DECLINED' }, REQUEST_ID);
      expect(() => new Date(result.classifiedAt)).not.toThrow();
    });

    it('preserves original error code casing in response', async () => {
      const result = await classifyError({ errorCode: 'card_declined' }, REQUEST_ID);
      expect(result.originalCode).toBe('card_declined');
    });
  });
});
