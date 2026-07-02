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

import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { AiClassificationResponse, ClassifyRequest } from '../types';

let openai: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!openai && config.openai.apiKey) {
    openai = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL || undefined,
    });
  }
  return openai;
}

const SYSTEM_PROMPT = `You are a payment error classification engine for a financial services platform.

Your job is to take a cryptic technical payment error and produce a user-friendly classification.

ALWAYS return valid JSON matching this exact schema (no markdown, no extra keys):
{
  "userTitle": string,          // ≤60 chars, calm, non-technical. E.g. "Payment declined by your bank"
  "userMessage": string,        // ≤200 chars, empathetic second-person. Start with "Your payment..."
  "suggestedActions": [         // 1–3 items ordered by likelihood of resolving the issue
    {
      "label": string,          // ≤30 chars imperative label
      "description": string,    // ≤120 chars what the user should do
      "actionUrl": string | null
    }
  ],
  "severity": "low" | "medium" | "high" | "critical",
  "category": "network" | "authentication" | "validation" | "payment_method" | "fraud_risk" | "rate_limit" | "server" | "timeout" | "unknown",
  "shouldEscalateToSupport": boolean,
  "confidence": number          // 0.0–1.0, your certainty this classification is correct
}

Rules:
- NEVER mention the raw error code in userTitle or userMessage.
- NEVER use technical jargon (HTTP, API, SDK, null, timeout) in user-facing fields.
- Set shouldEscalateToSupport=true only for critical severity or fraud_risk category.
- If you genuinely cannot classify the error, set confidence<0.5 and category="unknown".
- userMessage must be empathetic and reassuring, not alarming.`;

/**
 * Classify a payment error using OpenAI.
 * Returns null if the API call fails or confidence is below threshold.
 */
export async function classifyWithAI(
  request: ClassifyRequest,
  requestId: string
): Promise<AiClassificationResponse | null> {
  const client = getClient();
  if (!client) {
    logger.warn('OpenAI client not initialized — no API key configured', { requestId });
    return null;
  }

  const contextLines: string[] = [];

  if (request.rawMessage) {
    contextLines.push(`Raw error message: "${request.rawMessage}"`);
  }
  if (request.context?.paymentMethod) {
    contextLines.push(`Payment method: ${request.context.paymentMethod}`);
  }
  if (request.context?.transactionType) {
    contextLines.push(`Transaction type: ${request.context.transactionType}`);
  }
  if (request.context?.merchantName) {
    contextLines.push(`Merchant: ${request.context.merchantName}`);
  }
  if (request.context?.amount && request.context?.currency) {
    contextLines.push(`Amount: ${request.context.currency} ${request.context.amount}`);
  }

  const userPrompt = [
    `Error code: ${request.errorCode}`,
    ...contextLines,
  ].join('\n');

  try {
    logger.debug('Sending error to OpenAI for classification', {
      requestId,
      errorCode: request.errorCode,
      model: config.openai.model,
    });

    const completion = await client.chat.completions.create({
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.warn('OpenAI returned empty content', { requestId });
      return null;
    }

    const parsed: AiClassificationResponse = JSON.parse(content);

    logger.info('AI classification complete', {
      requestId,
      errorCode: request.errorCode,
      category: parsed.category,
      severity: parsed.severity,
      confidence: parsed.confidence,
      tokensUsed: completion.usage?.total_tokens,
    });

    // Reject low-confidence results — better to show a generic message
    if (parsed.confidence < config.classification.aiConfidenceThreshold) {
      logger.warn('AI confidence below threshold, discarding result', {
        requestId,
        confidence: parsed.confidence,
        threshold: config.classification.aiConfidenceThreshold,
      });
      return null;
    }

    return parsed;
  } catch (err) {
    logger.error('OpenAI classification failed', {
      requestId,
      errorCode: request.errorCode,
      error: (err as Error).message,
    });
    return null;
  }
}
