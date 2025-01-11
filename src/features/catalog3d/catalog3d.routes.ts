import { Router } from 'express';
import { searchCatalog3D } from './catalog3d.module.js';
import {
  updateModelPermissions,
  listModelPermissions,
} from './catalog3d.permissions.js';
import {
  searchValidation,
  updatePermissionsValidation,
} from './catalog3d.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import { authorize } from '../auth/auth.middleware.js';

const router = Router();

router.get('/catalogo3d', searchValidation, asyncHandler(searchCatalog3D));

// Rotas de gerenciamento de permissões (apenas admin)
router.get(
  '/permissions/:modelId',
  authorize([UserRole.ADMIN]),
  asyncHandler(listModelPermissions),
);

router.put(
  '/permissions/:modelId',
  authorize([UserRole.ADMIN]),
  updatePermissionsValidation,
  asyncHandler(updateModelPermissions),
);

export default router;
