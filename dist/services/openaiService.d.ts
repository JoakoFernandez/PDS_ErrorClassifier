/**
 * @file services/openaiService.ts
 * @description OpenAI-powered fallback classifier for unknown PDS error codes.
 *
 * Classification pipeline role:
 * ─────────────────────────────
 * This service is the THIRD lookup layer (after static map → Redis cache).
 * It handles novel or undocumented error codes that aren't in the static map.
 *
 * Why GPT-4o-mini by default:
 * ──────────────────────────
 * • 95%+ accuracy on error classification at ~10x lower cost than GPT-4o.
 * • Low temperature (0.2) keeps outputs deterministic enough to cache safely.
 * • Upgrade to gpt-4o in OPENAI_MODEL if your error messages are highly
 *   ambiguous or contain mixed languages.
 *
 * Prompt engineering decisions:
 * ──────────────────────────────
 * 1. System prompt defines the AI's role and output schema up front.
 * 2. Context fields (paymentMethod, transactionType) are injected when available
 *    to improve message personalisation.
 * 3. We ask for a `confidence` float — when below threshold, we fall back to
 *    a generic message rather than showing a low-quality classification.
 * 4. JSON-only output is enforced via response_format to avoid parsing failures.
 */
import type { AiClassificationResponse, ClassifyRequest } from '../types';
/**
 * Classify a payment error using OpenAI.
 * Returns null if the API call fails or confidence is below threshold.
 */
export declare function classifyWithAI(request: ClassifyRequest, requestId: string): Promise<AiClassificationResponse | null>;
//# sourceMappingURL=openaiService.d.ts.map