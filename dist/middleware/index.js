"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
exports.requestLoggerMiddleware = requestLoggerMiddleware;
exports.errorHandlerMiddleware = errorHandlerMiddleware;
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
}
function requestLoggerMiddleware(req, res, next) {
    const start = Date.now();
    const requestId = req.headers['x-request-id'];
    res.on('finish', () => {
        logger_1.logger.info('Request completed', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - start,
            userAgent: req.headers['user-agent'],
        });
    });
    next();
}
function errorHandlerMiddleware(err, req, res, _next) {
    const requestId = req.headers['x-request-id'];
    logger_1.logger.error('Unhandled error', {
        requestId,
        error: err.message,
        stack: err.stack,
    });
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred. Please try again.',
        },
        requestId,
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=index.js.map