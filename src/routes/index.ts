import { Router } from 'express';
import {
  classifyHandler,
  classifyBatchHandler,
  invalidateCacheHandler,
  healthHandler,
} from '../controllers/classifierController';
import { validateBody, ClassifyRequestSchema } from '../middleware/validateRequest';
import { z } from 'zod';

const router = Router();

const BatchRequestSchema = z.object({
  errors: z
    .array(ClassifyRequestSchema)
    .min(1, 'errors array must not be empty')
    .max(20, 'Maximum 20 errors per batch'),
});

router.post('/classify', validateBody(ClassifyRequestSchema), classifyHandler);

router.post('/classify/batch', validateBody(BatchRequestSchema), classifyBatchHandler);

router.get('/health', healthHandler);

router.delete('/cache/:errorCode', invalidateCacheHandler);

export { router };
