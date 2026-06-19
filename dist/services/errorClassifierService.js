"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyError = classifyError;
const uuid_1 = require("uuid");
const staticErrorMap_1 = require("../utils/staticErrorMap");
const cacheService_1 = require("./cacheService");
const openaiService_1 = require("./openaiService");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
/** Generic fallback used when classification fails at all layers. */
const FALLBACK_CLASSIFICATION = {
    userTitle: 'Payment could not be completed',
    userMessage: "We were unable to process your payment right now. No charge has been made. Please try again or contact our support team for assistance.",
    suggestedActions: [
        {
            label: 'Try Again',
            description: 'Wait a moment and attempt the payment again.',
        },
        {
            label: 'Contact Support',
            description: 'Our support team is available 24/7 to help.',
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
async function classifyError(request, requestId) {
    const normalisedCode = request.errorCode.trim().toUpperCase();
    const supportReferenceCode = generateSupportCode();
    const now = new Date().toISOString();
    // ── Layer 1: Static Map ──────────────────────────────────────────────────
    const staticEntry = (0, staticErrorMap_1.lookupStaticError)(normalisedCode);
    if (staticEntry) {
        logger_1.logger.debug('Static map hit', { requestId, errorCode: normalisedCode });
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
    const cached = await cacheService_1.cacheService.get(normalisedCode);
    if (cached) {
        logger_1.logger.debug('Redis cache hit', { requestId, errorCode: normalisedCode });
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
    if (config_1.config.classification.aiFallbackEnabled) {
        const aiResult = await (0, openaiService_1.classifyWithAI)(request, requestId);
        if (aiResult) {
            const classified = {
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
            await cacheService_1.cacheService.set(normalisedCode, classified);
            return classified;
        }
    }
    // ── Layer 4: Generic Fallback ────────────────────────────────────────────
    logger_1.logger.warn('All classification layers exhausted — using fallback', {
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
function generateSupportCode() {
    return `PDS-${(0, uuid_1.v4)().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
//# sourceMappingURL=errorClassifierService.js.map