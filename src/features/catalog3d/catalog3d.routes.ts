import { Router } from 'express';
import { searchCatalog3D } from './catalog3d.module.js';
import { searchValidation } from './catalog3d.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';

const router = Router();

router.get('/catalogo3d', searchValidation, asyncHandler(searchCatalog3D));

export default router;
