/**
 * @file types/index.ts
 * @description Central type definitions for the PDS Error Classifier.
 *
 * Design decision: Using discriminated unions for ClassificationSource lets
 * callers know exactly where a result came from, which is critical for
 * observability, debugging, and future A/B testing of classification strategies.
 */
/**
 * Error severity levels used for UI presentation and escalation logic.
 * - `low`      : Transient glitch; user can retry immediately.
 * - `medium`   : Configuration or input issue; user action required.
 * - `high`     : Service degradation; may resolve on its own.
 * - `critical` : Complete payment failure; escalate to support.
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';
/**
 * Broad categories that group errors for routing, analytics, and template selection.
 * Adding new categories here (and updating STATIC_ERROR_MAP) is the primary
 * extension point for new payment integrations.
 */
export type ErrorCategory = 'network' | 'authentication' | 'validation' | 'payment_method' | 'fraud_risk' | 'rate_limit' | 'server' | 'timeout' | 'unknown';
/**
 * Discriminated union indicating where the classification result originated.
 * Used to measure cache hit rates and AI usage in dashboards/analytics.
 */
export type ClassificationSource = 'static_map' | 'redis_cache' | 'ai_classification' | 'fallback';
/** A single actionable step the end-user can take to resolve the error. */
export interface SuggestedAction {
    /** Short imperative label shown in UI buttons or numbered lists. */
    label: string;
    /** Full description of what the user should do and why. */
    description: string;
    /**
     * Optional deep-link or URL for self-service resolution.
     * When provided, the UI can render this as a direct CTA button.
     */
    actionUrl?: string;
}
/** The fully enriched, user-facing representation of a payment error. */
export interface ClassifiedError {
    /** Original technical error code as received (e.g. "504", "INVALID_PARAM"). */
    originalCode: string;
    /** Short, human-readable title (≤ 60 chars) suitable for toast notifications. */
    userTitle: string;
    /**
     * Friendly, non-technical explanation of what went wrong.
     * Written in second person ("Your payment…") for empathy.
     */
    userMessage: string;
    /** Ordered list of concrete steps the user should try. */
    suggestedActions: SuggestedAction[];
    severity: Severity;
    category: ErrorCategory;
    /**
     * Whether the user should be directed to call/chat support.
     * Automatically `true` for critical severity or fraud_risk category.
     */
    shouldEscalateToSupport: boolean;
    /** Opaque reference code users can quote when contacting support. */
    supportReferenceCode: string;
    /** ISO-8601 timestamp of classification. */
    classifiedAt: string;
    /** Where the classification came from — drives observability metrics. */
    source: ClassificationSource;
    /**
     * Confidence score (0–1) for AI classifications.
     * Always 1.0 for static_map hits (deterministic).
     */
    confidence: number;
}
/** Incoming request body for the classify endpoint. */
export interface ClassifyRequest {
    /** The raw error code from the payment system (e.g. "504", "card_declined"). */
    errorCode: string;
    /**
     * Optional raw error message from the PDS system.
     * Providing this dramatically improves AI classification accuracy.
     */
    rawMessage?: string;
    /**
     * Optional payment context sent from the calling service.
     * Helps AI tailor the user-facing message (e.g. "subscription renewal" vs "checkout").
     */
    context?: {
        paymentMethod?: string;
        transactionType?: string;
        merchantName?: string;
        amount?: number;
        currency?: string;
    };
}
/** API response envelope — all endpoints return this shape. */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
    /** Request tracing ID for log correlation. */
    requestId: string;
    timestamp: string;
}
/** Internal Redis cache entry wrapping a ClassifiedError with metadata. */
export interface CacheEntry {
    classification: ClassifiedError;
    cachedAt: string;
    hitCount: number;
}
/**
 * Structured JSON schema expected from the OpenAI classification call.
 * Kept separate from ClassifiedError so the AI contract can evolve
 * independently from the public API shape.
 */
export interface AiClassificationResponse {
    userTitle: string;
    userMessage: string;
    suggestedActions: SuggestedAction[];
    severity: Severity;
    category: ErrorCategory;
    shouldEscalateToSupport: boolean;
    confidence: number;
}
//# sourceMappingURL=index.d.ts.map