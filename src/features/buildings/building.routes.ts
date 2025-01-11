import { Router } from 'express';
import { findNearestBuilding } from './building.module.js';
import { buildingSearchValidation } from './building.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';

const router = Router();

router.get(
  '/feicoes',
  buildingSearchValidation,
  asyncHandler(findNearestBuilding),
);

export default router;
