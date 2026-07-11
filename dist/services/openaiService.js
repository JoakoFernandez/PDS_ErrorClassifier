"use strict";
/**
 * @file services/openaiService.ts
 * @description AI-powered fallback classifier for unknown PDS error codes.
 * Uses native fetch instead of the OpenAI SDK to support any OpenAI-compatible
 * provider (Groq, Gemini, etc.) without SDK-level baseURL issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyWithAI = classifyWithAI;
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const SYSTEM_PROMPT = `You are a payment error classification engine for a financial services platform. All user-facing output MUST be in neutral Spanish.

Your job is to take a cryptic technical payment error and produce a user-friendly classification in Spanish.

ALWAYS return valid JSON matching this exact schema (no markdown, no extra keys):
{
  "userTitle": string,          // ≤60 chars, calm, non-technical, in Spanish. E.g. "Pago rechazado por tu banco"
  "userMessage": string,        // ≤200 chars, empathetic second-person, in Spanish. Start with "Tu pago..."
  "suggestedActions": [         // 1–3 items ordered by likelihood of resolving the issue
    {
      "label": string,          // ≤30 chars imperative label in Spanish
      "description": string,    // ≤120 chars what the user should do in Spanish
      "actionUrl": string | null
    }
  ],
  "severity": "low" | "medium" | "high" | "critical",
  "category": "network" | "authentication" | "validation" | "payment_method" | "fraud_risk" | "rate_limit" | "server" | "timeout" | "unknown",
  "shouldEscalateToSupport": boolean,
  "confidence": number          // 0.0–1.0, your certainty this classification is correct
}

Rules:
- ALL user-facing fields (userTitle, userMessage, suggestedActions) MUST be in neutral Spanish.
- NEVER mention the raw error code in userTitle or userMessage.
- NEVER use technical jargon (HTTP, API, SDK, null, timeout) in user-facing fields.
- Set shouldEscalateToSupport=true only for critical severity or fraud_risk category.
- If you genuinely cannot classify the error, set confidence<0.5 and category="unknown".
- userMessage must be empathetic and reassuring, not alarming.`;
function buildUserPrompt(request) {
    const lines = [`Error code: ${request.errorCode}`];
    if (request.rawMessage) {
        lines.push(`Raw error message: "${request.rawMessage}"`);
    }
    if (request.context?.paymentMethod) {
        lines.push(`Payment method: ${request.context.paymentMethod}`);
    }
    if (request.context?.transactionType) {
        lines.push(`Transaction type: ${request.context.transactionType}`);
    }
    if (request.context?.merchantName) {
        lines.push(`Merchant: ${request.context.merchantName}`);
    }
    if (request.context?.amount && request.context?.currency) {
        lines.push(`Amount: ${request.context.currency} ${request.context.amount}`);
    }
    return lines.join('\n');
}
/**
 * Classify a payment error using an AI provider (OpenAI, Groq, Gemini, etc.).
 * Uses native fetch to avoid SDK-level baseURL issues.
 * Returns null if the API call fails or confidence is below threshold.
 */
async function classifyWithAI(request, requestId) {
    if (!config_1.config.openai.apiKey) {
        logger_1.logger.warn('No API key configured — skipping AI classification', { requestId });
        return null;
    }
    const baseURL = config_1.config.openai.baseURL || 'https://api.openai.com/v1';
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
    logger_1.logger.debug('Calling AI provider for classification', {
        requestId,
        errorCode: request.errorCode,
        provider: baseURL,
        model: config_1.config.openai.model,
    });
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config_1.config.openai.apiKey}`,
            },
            body: JSON.stringify({
                model: config_1.config.openai.model,
                max_tokens: config_1.config.openai.maxTokens,
                temperature: config_1.config.openai.temperature,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: buildUserPrompt(request) },
                ],
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error('AI provider returned error', {
                requestId,
                errorCode: request.errorCode,
                status: response.status,
                statusText: response.statusText,
                body: errorBody.slice(0, 300),
            });
            return null;
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            logger_1.logger.warn('AI provider returned empty content', { requestId });
            return null;
        }
        const parsed = JSON.parse(content);
        logger_1.logger.info('AI classification complete', {
            requestId,
            errorCode: request.errorCode,
            category: parsed.category,
            severity: parsed.severity,
            confidence: parsed.confidence,
            tokensUsed: data.usage?.total_tokens,
        });
        if (parsed.confidence < config_1.config.classification.aiConfidenceThreshold) {
            logger_1.logger.warn('AI confidence below threshold — discarding result', {
                requestId,
                confidence: parsed.confidence,
                threshold: config_1.config.classification.aiConfidenceThreshold,
            });
            return null;
        }
        return parsed;
    }
    catch (err) {
        logger_1.logger.error('AI classification failed', {
            requestId,
            errorCode: request.errorCode,
            error: err.message,
        });
        return null;
    }
}
//# sourceMappingURL=openaiService.js.map