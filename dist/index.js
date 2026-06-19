"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("./config");
const index_1 = require("./routes/index");
const index_2 = require("./middleware/index");
const cacheService_1 = require("./services/cacheService");
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '100kb' }));
app.use(index_2.requestIdMiddleware);
app.use(index_2.requestLoggerMiddleware);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.windowMs,
    max: config_1.config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down and try again in a minute.',
        },
    },
});
app.use('/api/', limiter);
app.use('/api/v1', index_1.router);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    });
});
app.use(index_2.errorHandlerMiddleware);
async function bootstrap() {
    await cacheService_1.cacheService.connect();
    app.listen(config_1.config.port, () => {
        logger_1.logger.info('PDS Error Classifier started', {
            port: config_1.config.port,
            env: config_1.config.nodeEnv,
            aiEnabled: config_1.config.classification.aiFallbackEnabled,
            model: config_1.config.openai.model,
        });
    });
}
bootstrap().catch((err) => {
    logger_1.logger.error('Failed to start server', { error: err.message });
    process.exit(1);
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received — shutting down gracefully');
    await cacheService_1.cacheService.disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map