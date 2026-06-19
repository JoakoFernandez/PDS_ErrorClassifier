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
import type { ClassifiedError, ClassifyRequest } from '../types';
/**
 * Classify a PDS payment error through the 4-layer pipeline.
 *
 * @param request - The incoming classification request (code + optional context).
 * @param requestId - Correlation ID for log tracing.
 * @returns A fully populated ClassifiedError ready to return to the caller.
 */
export declare function classifyError(request: ClassifyRequest, requestId: string): Promise<ClassifiedError>;
//# sourceMappingURL=errorClassifierService.d.ts.map