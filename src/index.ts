import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { router } from './routes/index';
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  errorHandlerMiddleware,
} from './middleware/index';
import { cacheService } from './services/cacheService';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '100kb' }));

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
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

app.use('/api/v1', router);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
  });
});

app.use(errorHandlerMiddleware);

async function bootstrap(): Promise<void> {
  await cacheService.connect();

  app.listen(config.port, () => {
    logger.info('PDS Error Classifier started', {
      port: config.port,
      env: config.nodeEnv,
      aiEnabled: config.classification.aiFallbackEnabled,
      model: config.openai.model,
    });
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: (err as Error).message });
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await cacheService.disconnect();
  process.exit(0);
});

export { app };
