/**
 * @file middleware/validateRequest.ts
 * @description Zod-based request body validation middleware.
 *
 * Why validate at the middleware layer:
 * • Controllers stay focused on business logic, not input sanitisation.
 * • Consistent 400 error shapes across all endpoints.
 * • Zod's error messages are developer-friendly and surfaced in the response.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const ClassifyRequestSchema = z.object({
  errorCode: z
    .string()
    .min(1, 'errorCode is required')
    .max(100, 'errorCode must be 100 characters or fewer')
    .trim(),
  rawMessage: z.string().max(500).optional(),
  context: z
    .object({
      paymentMethod: z.string().max(50).optional(),
      transactionType: z.string().max(50).optional(),
      merchantName: z.string().max(100).optional(),
      amount: z.number().positive().optional(),
      currency: z.string().length(3).optional(),
    })
    .optional(),
});

/**
 * Factory that returns an Express middleware validating `req.body` against `schema`.
 * On failure, responds with 400 and zod error details.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
