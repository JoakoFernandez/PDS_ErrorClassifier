/**
 * @file services/errorClassifierService.ts
 * @description Orchestrates the 4-layer classification pipeline.
 *
 * Pipeline (each layer short-circuits on a hit):
 * ───────────────────────────────────────────────
 *  Layer 1 — Static Map  : O(1) in-process lookup for known codes.
 *  Layer 2 — Redis Cache : Sub-millisecond lookup for previously AI-classified codes.
 *  Layer 3 — OpenAI AI   : GPT classification for unknown codes (async, ~500ms).
 *  Layer 4 — Fallback    : Generic safe message when all else fails.
 *
 * This layered approach means:
 * • 80-90% of traffic (known error codes) never hits the network.
 * • Novel errors are classified once, then cached for subsequent callers.
 * • A complete OpenAI or Redis outage degrades gracefully to static + fallback.
 */

import { v4 as uuidv4 } from 'uuid';
import { lookupStaticError } from '../utils/staticErrorMap';
import { cacheService } from './cacheService';
import { classifyWithAI } from './openaiService';
import { logger } from '../utils/logger';
import { config } from '../config';
import type { ClassifiedError, ClassifyRequest } from '../types';

/** Generic fallback used when classification fails at all layers. */
const FALLBACK_CLASSIFICATION: Omit<ClassifiedError,
  'originalCode' | 'supportReferenceCode' | 'classifiedAt'> = {
  userTitle: 'No se pudo completar el pago',
  userMessage:
    'No pudimos procesar tu pago en este momento. No se realizó ningún cargo. Intenta de nuevo o contacta a nuestro equipo de soporte para recibir ayuda.',
  suggestedActions: [
    {
      label: 'Intentar de nuevo',
      description: 'Espera un momento y vuelve a intentar el pago.',
    },
    {
      label: 'Contactar a soporte',
      description: 'Nuestro equipo de soporte está disponible 24/7 para ayudarte.',
      actionUrl: '/support/chat',
    },
  ],
  severity: 'medium',
  category: 'unknown',
  shouldEscalateToSupport: false,
  source: 'fallback',
  confidence: 0,
};

/**
 * Classify a PDS payment error through the 4-layer pipeline.
 *
 * @param request - The incoming classification request (code + optional context).
 * @param requestId - Correlation ID for log tracing.
 * @returns A fully populated ClassifiedError ready to return to the caller.
 */
export async function classifyError(
  request: ClassifyRequest,
  requestId: string
): Promise<ClassifiedError> {
  const normalisedCode = request.errorCode.trim().toUpperCase();
  const supportReferenceCode = generateSupportCode();
  const now = new Date().toISOString();

  // ── Layer 1: Static Map ──────────────────────────────────────────────────
  const staticEntry = lookupStaticError(normalisedCode);
  if (staticEntry) {
    logger.debug('Static map hit', { requestId, errorCode: normalisedCode });
    return {
      ...staticEntry,
      originalCode: request.errorCode,
      supportReferenceCode,
      classifiedAt: now,
      source: 'static_map',
      confidence: 1.0,
    };
  }

  // ── Layer 2: Redis Cache ─────────────────────────────────────────────────
  const cached = await cacheService.get(normalisedCode);
  if (cached) {
    logger.debug('Redis cache hit', { requestId, errorCode: normalisedCode });
    return {
      ...cached,
      // Update per-request fields but keep the cached classification
      originalCode: request.errorCode,
      supportReferenceCode,
      classifiedAt: now,
      source: 'redis_cache',
    };
  }

  // ── Layer 3: AI Classification ───────────────────────────────────────────
  if (config.classification.aiFallbackEnabled) {
    const aiResult = await classifyWithAI(request, requestId);

    if (aiResult) {
      const classified: ClassifiedError = {
        originalCode: request.errorCode,
        userTitle: aiResult.userTitle,
        userMessage: aiResult.userMessage,
        suggestedActions: aiResult.suggestedActions,
        severity: aiResult.severity,
        category: aiResult.category,
        shouldEscalateToSupport: aiResult.shouldEscalateToSupport,
        supportReferenceCode,
        classifiedAt: now,
        source: 'ai_classification',
        confidence: aiResult.confidence,
      };

      // Cache the AI result so the next caller with the same code gets a fast response
      await cacheService.set(normalisedCode, classified);
      return classified;
    }
  }

  // ── Layer 4: Generic Fallback ────────────────────────────────────────────
  logger.warn('All classification layers exhausted — using fallback', {
    requestId,
    errorCode: normalisedCode,
  });

  return {
    ...FALLBACK_CLASSIFICATION,
    originalCode: request.errorCode,
    supportReferenceCode,
    classifiedAt: now,
  };
}

/**
 * Generate a short, user-quotable support reference code.
 * Format: PDS-XXXXXXXX (8 hex chars) — memorable yet unique enough for support lookups.
 */
function generateSupportCode(): string {
  return `PDS-${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
