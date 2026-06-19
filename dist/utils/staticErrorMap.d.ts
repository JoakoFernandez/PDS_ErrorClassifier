/**
 * @file utils/staticErrorMap.ts
 * @description Hand-curated map of known PDS error codes to user-friendly classifications.
 *
 * Design rationale:
 * ─────────────────
 * This map is the FIRST lookup in the classification pipeline (before Redis cache
 * and before OpenAI). It provides:
 *   1. Zero-latency resolution for common, well-understood errors.
 *   2. Deterministic, legally-reviewed messaging for sensitive codes (e.g. fraud).
 *   3. A cost shield — known errors never consume an OpenAI API call.
 *
 * Maintenance guide:
 * ─────────────────
 * • Add new codes in the appropriate category block below.
 * • For payment-processor-specific codes, prefix with the processor name
 *   (e.g. "STRIPE_card_declined") to avoid collisions.
 * • All codes are normalised to UPPERCASE before lookup (see errorClassifierService).
 * • Keep userMessage < 200 chars — it may appear in SMS notifications.
 */
import type { ClassifiedError } from '../types';
/** Partial classification stored in the map; runtime fields are added at query time. */
type StaticEntry = Omit<ClassifiedError, 'originalCode' | 'supportReferenceCode' | 'classifiedAt' | 'source' | 'confidence'>;
export declare const STATIC_ERROR_MAP: Record<string, StaticEntry>;
/**
 * Looks up a normalised error code in the static map.
 * Normalisation: trim whitespace + uppercase for case-insensitive matching.
 */
export declare function lookupStaticError(code: string): StaticEntry | undefined;
export {};
//# sourceMappingURL=staticErrorMap.d.ts.map