"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const classifierController_1 = require("../controllers/classifierController");
const validateRequest_1 = require("../middleware/validateRequest");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
exports.router = router;
const BatchRequestSchema = zod_1.z.object({
    errors: zod_1.z
        .array(validateRequest_1.ClassifyRequestSchema)
        .min(1, 'errors array must not be empty')
        .max(20, 'Maximum 20 errors per batch'),
});
router.post('/classify', (0, validateRequest_1.validateBody)(validateRequest_1.ClassifyRequestSchema), classifierController_1.classifyHandler);
router.post('/classify/batch', (0, validateRequest_1.validateBody)(BatchRequestSchema), classifierController_1.classifyBatchHandler);
router.get('/health', classifierController_1.healthHandler);
router.delete('/cache/:errorCode', classifierController_1.invalidateCacheHandler);
//# sourceMappingURL=index.js.map