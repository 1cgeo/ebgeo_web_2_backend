import { Router } from 'express';
import { searchCatalog3D } from './catalog3d.module.js';
import {
  updateModelPermissions,
  listModelPermissions,
} from './catalog3d.permissions.js';
import {
  searchValidation,
  updatePermissionsValidation,
  listModelPermissionsValidation,
  validateUUIDParam,
} from './catalog3d.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import { authorize } from '../auth/auth.middleware.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

router.get(
  '/catalogo3d',
  validateRequest(searchValidation),
  asyncHandler(searchCatalog3D),
);

router.get(
  '/permissions',
  authorize([UserRole.ADMIN]),
  validateRequest(listModelPermissionsValidation),
  asyncHandler(listModelPermissions),
);

// Rotas de gerenciamento de permissões (apenas admin)
router.get(
  '/permissions/:modelId',
  authorize([UserRole.ADMIN]),
  validateRequest(validateUUIDParam),
  asyncHandler(listModelPermissions),
);

router.put(
  '/permissions/:modelId',
  authorize([UserRole.ADMIN]),
  validateRequest(updatePermissionsValidation),
  asyncHandler(updateModelPermissions),
);

export default router;
