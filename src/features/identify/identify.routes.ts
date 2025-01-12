import { Router } from 'express';
import { findNearestFeature } from './identify.module.js';
import { identifyValidation } from './identify.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';

const router = Router();

router.get('/feicoes', identifyValidation, asyncHandler(findNearestFeature));

export default router;
