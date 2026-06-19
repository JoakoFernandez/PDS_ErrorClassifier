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
export declare const ClassifyRequestSchema: z.ZodObject<{
    errorCode: z.ZodString;
    rawMessage: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodObject<{
        paymentMethod: z.ZodOptional<z.ZodString>;
        transactionType: z.ZodOptional<z.ZodString>;
        merchantName: z.ZodOptional<z.ZodString>;
        amount: z.ZodOptional<z.ZodNumber>;
        currency: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        paymentMethod?: string | undefined;
        transactionType?: string | undefined;
        merchantName?: string | undefined;
        amount?: number | undefined;
        currency?: string | undefined;
    }, {
        paymentMethod?: string | undefined;
        transactionType?: string | undefined;
        merchantName?: string | undefined;
        amount?: number | undefined;
        currency?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    errorCode: string;
    rawMessage?: string | undefined;
    context?: {
        paymentMethod?: string | undefined;
        transactionType?: string | undefined;
        merchantName?: string | undefined;
        amount?: number | undefined;
        currency?: string | undefined;
    } | undefined;
}, {
    errorCode: string;
    rawMessage?: string | undefined;
    context?: {
        paymentMethod?: string | undefined;
        transactionType?: string | undefined;
        merchantName?: string | undefined;
        amount?: number | undefined;
        currency?: string | undefined;
    } | undefined;
}>;
/**
 * Factory that returns an Express middleware validating `req.body` against `schema`.
 * On failure, responds with 400 and zod error details.
 */
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validateRequest.d.ts.map