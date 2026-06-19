"use strict";
/**
 * @file controllers/classifierController.ts
 * @description HTTP handlers for all classifier endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyHandler = classifyHandler;
exports.classifyBatchHandler = classifyBatchHandler;
exports.invalidateCacheHandler = invalidateCacheHandler;
exports.healthHandler = healthHandler;
const errorClassifierService_1 = require("../services/errorClassifierService");
const cacheService_1 = require("../services/cacheService");
const staticErrorMap_1 = require("../utils/staticErrorMap");
const logger_1 = require("../utils/logger");
/**
 * POST /api/v1/classify
 *
 * Classifies a single payment error code through the 4-layer pipeline.
 * Returns a user-friendly message, suggested actions, and support reference.
 */
async function classifyHandler(req, res) {
    const requestId = req.headers['x-request-id'];
    const body = req.body;
    logger_1.logger.info('Classification request received', {
        requestId,
        errorCode: body.errorCode,
        hasRawMessage: !!body.rawMessage,
        hasContext: !!body.context,
    });
    const classification = await (0, errorClassifierService_1.classifyError)(body, requestId);
    const response = {
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
async function classifyBatchHandler(req, res) {
    const requestId = req.headers['x-request-id'];
    const { errors } = req.body;
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
    logger_1.logger.info('Batch classification request', { requestId, count: errors.length });
    // Process in parallel — each item runs through its own pipeline independently
    const results = await Promise.allSettled(errors.map((e) => (0, errorClassifierService_1.classifyError)(e, requestId)));
    const classifications = results.map((result, i) => ({
        index: i,
        errorCode: errors[i].errorCode,
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : undefined,
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
async function invalidateCacheHandler(req, res) {
    const requestId = req.headers['x-request-id'];
    const { errorCode } = req.params;
    const success = await cacheService_1.cacheService.invalidate(errorCode);
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
async function healthHandler(_req, res) {
    const redis = await cacheService_1.cacheService.ping();
    res.status(redis.healthy ? 200 : 207).json({
        status: redis.healthy ? 'healthy' : 'degraded',
        checks: {
            redis: {
                status: redis.healthy ? 'up' : 'down',
                latencyMs: redis.latencyMs,
            },
            staticMap: {
                status: 'up',
                entriesLoaded: Object.keys(staticErrorMap_1.STATIC_ERROR_MAP).length,
            },
        },
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=classifierController.js.map