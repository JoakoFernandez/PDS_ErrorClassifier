"use strict";
/**
 * @file middleware/validateRequest.ts
 * @description Zod-based request body validation middleware.
 *
 * Why validate at the middleware layer:
 * • Controllers stay focused on business logic, not input sanitisation.
 * • Consistent 400 error shapes across all endpoints.
 * • Zod's error messages are developer-friendly and surfaced in the response.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassifyRequestSchema = void 0;
exports.validateBody = validateBody;
const zod_1 = require("zod");
exports.ClassifyRequestSchema = zod_1.z.object({
    errorCode: zod_1.z
        .string()
        .min(1, 'errorCode is required')
        .max(100, 'errorCode must be 100 characters or fewer')
        .trim(),
    rawMessage: zod_1.z.string().max(500).optional(),
    context: zod_1.z
        .object({
        paymentMethod: zod_1.z.string().max(50).optional(),
        transactionType: zod_1.z.string().max(50).optional(),
        merchantName: zod_1.z.string().max(100).optional(),
        amount: zod_1.z.number().positive().optional(),
        currency: zod_1.z.string().length(3).optional(),
    })
        .optional(),
});
/**
 * Factory that returns an Express middleware validating `req.body` against `schema`.
 * On failure, responds with 400 and zod error details.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request body validation failed',
                    details: result.error.flatten().fieldErrors,
                },
                requestId: req.headers['x-request-id'] || 'unknown',
                timestamp: new Date().toISOString(),
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
//# sourceMappingURL=validateRequest.js.map