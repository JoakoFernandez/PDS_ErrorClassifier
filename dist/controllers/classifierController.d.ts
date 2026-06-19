/**
 * @file controllers/classifierController.ts
 * @description HTTP handlers for all classifier endpoints.
 */
import { Request, Response } from 'express';
/**
 * POST /api/v1/classify
 *
 * Classifies a single payment error code through the 4-layer pipeline.
 * Returns a user-friendly message, suggested actions, and support reference.
 */
export declare function classifyHandler(req: Request, res: Response): Promise<void>;
/**
 * POST /api/v1/classify/batch
 *
 * Classifies multiple error codes in parallel (up to 20).
 * Useful for error dashboards or bulk reprocessing.
 *
 * Addition rationale: Call centres often deal with multiple simultaneous errors
 * during an incident. A batch endpoint lets support tools retrieve all
 * classifications in a single round-trip instead of N sequential calls.
 */
export declare function classifyBatchHandler(req: Request, res: Response): Promise<void>;
/**
 * DELETE /api/v1/cache/:errorCode
 *
 * Invalidate a cached classification for a specific error code.
 * Useful when a static entry has been updated and the cache is stale.
 *
 * Addition rationale: Without this endpoint, a bad AI classification would
 * persist for the full TTL (default 1 hour). This gives ops teams a hot-fix
 * lever without requiring a Redis flush or service restart.
 */
export declare function invalidateCacheHandler(req: Request, res: Response): Promise<void>;
/**
 * GET /api/v1/health
 *
 * Health check for load balancer and Kubernetes liveness probes.
 * Checks Redis connectivity and reports static map size.
 */
export declare function healthHandler(_req: Request, res: Response): Promise<void>;
//# sourceMappingURL=classifierController.d.ts.map