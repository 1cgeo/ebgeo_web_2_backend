import { Router } from 'express';
import { findNearestFeature } from './identify.module.js';
import { identifyValidation } from './identify.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

router.get(
  '/feicoes',
  validateRequest(identifyValidation),
  asyncHandler(findNearestFeature),
);

export default router;
