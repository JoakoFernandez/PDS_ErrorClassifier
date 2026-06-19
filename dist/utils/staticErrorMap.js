"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATIC_ERROR_MAP = void 0;
exports.lookupStaticError = lookupStaticError;
const retry = {
    label: 'Try Again',
    description: 'Wait a few seconds and attempt the payment again.',
};
const updateCard = {
    label: 'Update Payment Method',
    description: 'Check that your card number, expiry date, and CVV are entered correctly.',
    actionUrl: '/account/payment-methods',
};
const contactBank = {
    label: 'Contact Your Bank',
    description: 'Call the number on the back of your card to ask why the transaction was blocked.',
};
const contactSupport = {
    label: 'Contact Support',
    description: 'Our support team can investigate and process your payment manually.',
    actionUrl: '/support/chat',
};
const useDifferentCard = {
    label: 'Use a Different Card',
    description: 'Try paying with another credit or debit card.',
    actionUrl: '/account/payment-methods/add',
};
// ─── Static Error Map ─────────────────────────────────────────────────────────
exports.STATIC_ERROR_MAP = {
    // ── HTTP / Gateway Errors ──────────────────────────────────────────────────
    '504': {
        userTitle: 'Payment taking longer than expected',
        userMessage: "Our payment system is taking too long to respond right now. Your card has not been charged. Please try again in a moment.",
        suggestedActions: [retry, contactSupport],
        severity: 'high',
        category: 'timeout',
        shouldEscalateToSupport: false,
    },
    '500': {
        userTitle: 'Something went wrong on our end',
        userMessage: "We experienced an internal error while processing your payment. No charge was made. Our team has been alerted.",
        suggestedActions: [retry, contactSupport],
        severity: 'high',
        category: 'server',
        shouldEscalateToSupport: false,
    },
    '503': {
        userTitle: 'Payment service temporarily unavailable',
        userMessage: "Our payment service is temporarily down for maintenance. Please try again in a few minutes.",
        suggestedActions: [retry],
        severity: 'medium',
        category: 'server',
        shouldEscalateToSupport: false,
    },
    '429': {
        userTitle: 'Too many payment attempts',
        userMessage: "You've made too many payment attempts in a short period. Please wait a minute before trying again.",
        suggestedActions: [{ label: 'Wait and Retry', description: 'Please wait 60 seconds, then try your payment again.' }],
        severity: 'low',
        category: 'rate_limit',
        shouldEscalateToSupport: false,
    },
    '401': {
        userTitle: 'Session expired',
        userMessage: "Your session has expired. Please log in again and reattempt your payment.",
        suggestedActions: [{ label: 'Log In Again', description: 'Sign back in to continue.', actionUrl: '/login' }],
        severity: 'medium',
        category: 'authentication',
        shouldEscalateToSupport: false,
    },
    // ── Validation / Input Errors ──────────────────────────────────────────────
    'INVALID_PARAM': {
        userTitle: 'Payment details incomplete',
        userMessage: "Some of your payment details appear to be missing or in the wrong format. Please review and resubmit.",
        suggestedActions: [updateCard],
        severity: 'medium',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_CARD_NUMBER': {
        userTitle: 'Card number not recognised',
        userMessage: "The card number you entered doesn't look right. Please double-check all 16 digits.",
        suggestedActions: [updateCard, useDifferentCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_EXPIRY': {
        userTitle: 'Card expiry date is invalid',
        userMessage: "Please check the expiry date on your card and enter it in MM/YY format.",
        suggestedActions: [updateCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_CVV': {
        userTitle: 'Security code incorrect',
        userMessage: "The 3 or 4-digit security code on your card doesn't match. Please re-enter it carefully.",
        suggestedActions: [updateCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'MISSING_BILLING_ADDRESS': {
        userTitle: 'Billing address required',
        userMessage: "Your billing address is missing. Please add your address to complete this payment.",
        suggestedActions: [{ label: 'Add Billing Address', description: 'Enter the address registered to your card.', actionUrl: '/account/billing' }],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    // ── Card / Payment Method Errors ───────────────────────────────────────────
    'CARD_DECLINED': {
        userTitle: 'Card declined',
        userMessage: "Your card was declined by your bank. This can happen for several reasons — please contact your bank or try a different card.",
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'INSUFFICIENT_FUNDS': {
        userTitle: 'Insufficient funds',
        userMessage: "Your card doesn't have enough available balance for this transaction. Please use a different payment method.",
        suggestedActions: [useDifferentCard, contactBank],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'CARD_EXPIRED': {
        userTitle: 'Your card has expired',
        userMessage: "The card on file has passed its expiry date. Please add a new card to continue.",
        suggestedActions: [useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'CARD_NOT_SUPPORTED': {
        userTitle: 'Card type not accepted',
        userMessage: "We don't currently accept this type of card. Please try Visa, Mastercard, or American Express.",
        suggestedActions: [useDifferentCard],
        severity: 'low',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'DO_NOT_HONOR': {
        userTitle: 'Payment not authorised by your bank',
        userMessage: "Your bank has declined this transaction. Please contact them directly to authorise the payment, then try again.",
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'LOST_CARD': {
        userTitle: 'This card has been reported lost',
        userMessage: "The card associated with your account has been reported lost or stolen. Please add a new card.",
        suggestedActions: [useDifferentCard, contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    'STOLEN_CARD': {
        userTitle: 'Card reported stolen',
        userMessage: "This card has been flagged as stolen. For your security, please contact your bank immediately.",
        suggestedActions: [contactBank, contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    'RESTRICTED_CARD': {
        userTitle: 'Card restricted for online payments',
        userMessage: "Your bank has restricted this card for online or international transactions. Please contact your bank or use a different card.",
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    // ── Fraud / Security ───────────────────────────────────────────────────────
    'FRAUD_SUSPECTED': {
        userTitle: 'Payment flagged for review',
        userMessage: "This payment has been flagged for additional review. No charge has been made. Please contact our support team to complete your purchase.",
        suggestedActions: [contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    // ── Network / Timeout ──────────────────────────────────────────────────────
    'NETWORK_ERROR': {
        userTitle: 'Network connection lost',
        userMessage: "We lost the connection while processing your payment. Your card has not been charged. Please check your internet connection and try again.",
        suggestedActions: [retry],
        severity: 'medium',
        category: 'network',
        shouldEscalateToSupport: false,
    },
    'CONNECTION_TIMEOUT': {
        userTitle: 'Connection timed out',
        userMessage: "The payment connection timed out. No charge was made. Please try again.",
        suggestedActions: [retry],
        severity: 'medium',
        category: 'timeout',
        shouldEscalateToSupport: false,
    },
};
/**
 * Looks up a normalised error code in the static map.
 * Normalisation: trim whitespace + uppercase for case-insensitive matching.
 */
function lookupStaticError(code) {
    return exports.STATIC_ERROR_MAP[code.trim().toUpperCase()];
}
//# sourceMappingURL=staticErrorMap.js.map