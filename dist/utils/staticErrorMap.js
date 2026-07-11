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
    label: 'Intentar de nuevo',
    description: 'Espera unos segundos e intenta realizar el pago otra vez.',
};
const updateCard = {
    label: 'Actualizar método de pago',
    description: 'Verifica que el número de tarjeta, fecha de vencimiento y CVV estén escritos correctamente.',
    actionUrl: '/account/payment-methods',
};
const contactBank = {
    label: 'Contacta a tu banco',
    description: 'Llama al número que está al reverso de tu tarjeta para preguntar por qué se bloqueó la transacción.',
};
const contactSupport = {
    label: 'Contactar a soporte',
    description: 'Nuestro equipo de soporte puede investigar y procesar tu pago de forma manual.',
    actionUrl: '/support/chat',
};
const useDifferentCard = {
    label: 'Usar otra tarjeta',
    description: 'Intenta pagar con otra tarjeta de crédito o débito.',
    actionUrl: '/account/payment-methods/add',
};
// ─── Static Error Map ─────────────────────────────────────────────────────────
exports.STATIC_ERROR_MAP = {
    // ── HTTP / Gateway Errors ──────────────────────────────────────────────────
    '504': {
        userTitle: 'El pago está tomando más tiempo de lo normal',
        userMessage: 'Nuestro sistema de pagos está tardando en responder. No se ha realizado ningún cargo a tu tarjeta. Por favor, intenta de nuevo en unos momentos.',
        suggestedActions: [retry, contactSupport],
        severity: 'high',
        category: 'timeout',
        shouldEscalateToSupport: false,
    },
    '500': {
        userTitle: 'Algo salió mal en nuestro sistema',
        userMessage: 'Ocurrió un error interno al procesar tu pago. No se realizó ningún cargo. Nuestro equipo ya fue notificado.',
        suggestedActions: [retry, contactSupport],
        severity: 'high',
        category: 'server',
        shouldEscalateToSupport: false,
    },
    '503': {
        userTitle: 'Servicio de pago temporalmente no disponible',
        userMessage: 'Nuestro servicio de pagos está en mantenimiento por unos momentos. Por favor, intenta de nuevo en unos minutos.',
        suggestedActions: [retry],
        severity: 'medium',
        category: 'server',
        shouldEscalateToSupport: false,
    },
    '429': {
        userTitle: 'Demasiados intentos de pago',
        userMessage: 'Has realizado demasiados intentos de pago en poco tiempo. Espera un minuto antes de intentar de nuevo.',
        suggestedActions: [{ label: 'Esperar e intentar de nuevo', description: 'Espera 60 segundos y vuelve a intentar tu pago.' }],
        severity: 'low',
        category: 'rate_limit',
        shouldEscalateToSupport: false,
    },
    '401': {
        userTitle: 'La sesión ha expirado',
        userMessage: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente e intenta realizar el pago.',
        suggestedActions: [{ label: 'Iniciar sesión', description: 'Ingresa de nuevo para continuar.', actionUrl: '/login' }],
        severity: 'medium',
        category: 'authentication',
        shouldEscalateToSupport: false,
    },
    // ── Validation / Input Errors ──────────────────────────────────────────────
    'INVALID_PARAM': {
        userTitle: 'Datos de pago incompletos',
        userMessage: 'Falta información o algunos datos tienen un formato incorrecto. Revísalos e inténtalo de nuevo.',
        suggestedActions: [updateCard],
        severity: 'medium',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_CARD_NUMBER': {
        userTitle: 'Número de tarjeta no reconocido',
        userMessage: 'El número de tarjeta ingresado no parece correcto. Verifica los 16 dígitos.',
        suggestedActions: [updateCard, useDifferentCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_EXPIRY': {
        userTitle: 'La fecha de vencimiento no es válida',
        userMessage: 'Revisa la fecha de vencimiento de tu tarjeta e ingrésala en formato MM/AA.',
        suggestedActions: [updateCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'INVALID_CVV': {
        userTitle: 'Código de seguridad incorrecto',
        userMessage: 'El código de seguridad de 3 o 4 dígitos no coincide. Ingrésalo nuevamente con cuidado.',
        suggestedActions: [updateCard],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    'MISSING_BILLING_ADDRESS': {
        userTitle: 'Dirección de facturación requerida',
        userMessage: 'Falta tu dirección de facturación. Agrega la dirección registrada en tu tarjeta para completar el pago.',
        suggestedActions: [{ label: 'Agregar dirección', description: 'Ingresa la dirección registrada en tu tarjeta.', actionUrl: '/account/billing' }],
        severity: 'low',
        category: 'validation',
        shouldEscalateToSupport: false,
    },
    // ── Card / Payment Method Errors ───────────────────────────────────────────
    'CARD_DECLINED': {
        userTitle: 'Tarjeta rechazada',
        userMessage: 'Tu banco rechazó la transacción. Esto puede ocurrir por varias razones. Contacta a tu banco o prueba con otra tarjeta.',
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'INSUFFICIENT_FUNDS': {
        userTitle: 'Fondos insuficientes',
        userMessage: 'Tu tarjeta no tiene saldo disponible suficiente para esta transacción. Usa otro método de pago.',
        suggestedActions: [useDifferentCard, contactBank],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'CARD_EXPIRED': {
        userTitle: 'Tu tarjeta ha vencido',
        userMessage: 'La tarjeta registrada ya pasó su fecha de vencimiento. Agrega una tarjeta nueva para continuar.',
        suggestedActions: [useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'CARD_NOT_SUPPORTED': {
        userTitle: 'Tipo de tarjeta no aceptado',
        userMessage: 'Actualmente no aceptamos este tipo de tarjeta. Prueba con Visa, Mastercard o American Express.',
        suggestedActions: [useDifferentCard],
        severity: 'low',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'DO_NOT_HONOR': {
        userTitle: 'Pago no autorizado por tu banco',
        userMessage: 'Tu banco rechazó esta transacción. Contáctalos para autorizar el pago y vuelve a intentarlo.',
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    'LOST_CARD': {
        userTitle: 'Esta tarjeta fue reportada como perdida',
        userMessage: 'La tarjeta asociada a tu cuenta fue reportada como perdida o robada. Por favor, agrega una tarjeta nueva.',
        suggestedActions: [useDifferentCard, contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    'STOLEN_CARD': {
        userTitle: 'Tarjeta reportada como robada',
        userMessage: 'Esta tarjeta fue marcada como robada. Por tu seguridad, contacta a tu banco inmediatamente.',
        suggestedActions: [contactBank, contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    'RESTRICTED_CARD': {
        userTitle: 'Tarjeta restringida para pagos en línea',
        userMessage: 'Tu banco restringió esta tarjeta para transacciones en línea o internacionales. Contacta a tu banco o usa otra tarjeta.',
        suggestedActions: [contactBank, useDifferentCard],
        severity: 'medium',
        category: 'payment_method',
        shouldEscalateToSupport: false,
    },
    // ── Fraud / Security ───────────────────────────────────────────────────────
    'FRAUD_SUSPECTED': {
        userTitle: 'Pago marcado para revisión',
        userMessage: 'Este pago fue marcado para revisión adicional. No se realizó ningún cargo. Contacta a nuestro equipo de soporte para completar tu compra.',
        suggestedActions: [contactSupport],
        severity: 'critical',
        category: 'fraud_risk',
        shouldEscalateToSupport: true,
    },
    // ── Network / Timeout ──────────────────────────────────────────────────────
    'NETWORK_ERROR': {
        userTitle: 'Conexión de red perdida',
        userMessage: 'Perdimos la conexión mientras procesábamos tu pago. No se realizó ningún cargo. Verifica tu conexión a internet e inténtalo de nuevo.',
        suggestedActions: [retry],
        severity: 'medium',
        category: 'network',
        shouldEscalateToSupport: false,
    },
    'CONNECTION_TIMEOUT': {
        userTitle: 'La conexión se agotó',
        userMessage: 'La conexión de pago se agotó. No se realizó ningún cargo. Por favor, inténtalo de nuevo.',
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