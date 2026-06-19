/**
 * @file controllers/classifierController.ts
 * @description HTTP handlers for all classifier endpoints.
 */

import { Request, Response } from 'express';
import { classifyError } from '../services/errorClassifierService';
import { cacheService } from '../services/cacheService';
import { STATIC_ERROR_MAP } from '../utils/staticErrorMap';
import { logger } from '../utils/logger';
import type { ApiResponse, ClassifiedError, ClassifyRequest } from '../types';

/**
 * POST /api/v1/classify
 *
 * Classifies a single payment error code through the 4-layer pipeline.
 * Returns a user-friendly message, suggested actions, and support reference.
 */
export async function classifyHandler(req: Request, res: Response): Promise<void> {
  const requestId = req.headers['x-request-id'] as string;
  const body: ClassifyRequest = req.body;

  logger.info('Classification request received', {
    requestId,
    errorCode: body.errorCode,
    hasRawMessage: !!body.rawMessage,
    hasContext: !!body.context,
  });

  const classification = await classifyError(body, requestId);

  const response: ApiResponse<ClassifiedError> = {
    success: true,
    data: classification,
    requestId,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
}

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
export async function classifyBatchHandler(req: Request, res: Response): Promise<void> {
  const requestId = req.headers['x-request-id'] as string;
  const { errors }: { errors: ClassifyRequest[] } = req.body;

  if (!Array.isArray(errors) || errors.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: '"errors" must be a non-empty array.' },
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (errors.length > 20) {
    res.status(400).json({
      success: false,
      error: { code: 'BATCH_TOO_LARGE', message: 'Maximum batch size is 20 errors.' },
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.info('Batch classification request', { requestId, count: errors.length });

  // Process in parallel — each item runs through its own pipeline independently
  const results = await Promise.allSettled(
    errors.map((e) => classifyError(e, requestId))
  );

  const classifications = results.map((result, i) => ({
    index: i,
    errorCode: errors[i].errorCode,
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? (result.reason as Error).message : undefined,
  }));

  res.status(200).json({
    success: true,
    data: { results: classifications, total: errors.length },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

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
export async function invalidateCacheHandler(req: Request, res: Response): Promise<void> {
  const requestId = req.headers['x-request-id'] as string;
  const { errorCode } = req.params;

  const success = await cacheService.invalidate(errorCode);

  res.status(200).json({
    success: true,
    data: { invalidated: success, errorCode },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /api/v1/health
 *
 * Health check for load balancer and Kubernetes liveness probes.
 * Checks Redis connectivity and reports static map size.
 */
export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const redis = await cacheService.ping();

  res.status(redis.healthy ? 200 : 207).json({
    status: redis.healthy ? 'healthy' : 'degraded',
    checks: {
      redis: {
        status: redis.healthy ? 'up' : 'down',
        latencyMs: redis.latencyMs,
      },
      staticMap: {
        status: 'up',
        entriesLoaded: Object.keys(STATIC_ERROR_MAP).length,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
