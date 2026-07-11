/**
 * @file services/openaiService.ts
 * @description AI-powered fallback classifier for unknown PDS error codes.
 * Uses native fetch instead of the OpenAI SDK to support any OpenAI-compatible
 * provider (Groq, Gemini, etc.) without SDK-level baseURL issues.
 */
import type { AiClassificationResponse, ClassifyRequest } from '../types';
/**
 * Classify a payment error using an AI provider (OpenAI, Groq, Gemini, etc.).
 * Uses native fetch to avoid SDK-level baseURL issues.
 * Returns null if the API call fails or confidence is below threshold.
 */
export declare function classifyWithAI(request: ClassifyRequest, requestId: string): Promise<AiClassificationResponse | null>;
//# sourceMappingURL=openaiService.d.ts.map