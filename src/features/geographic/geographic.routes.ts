import { Router } from 'express';
import { searchGeographicNames } from './geographic.module.js';
import { searchValidation } from './geographic.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';

const router = Router();

router.get('/busca', searchValidation, asyncHandler(searchGeographicNames));

export default router;
