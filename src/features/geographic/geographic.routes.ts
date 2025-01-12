import { Router } from 'express';
import { searchGeographicNames } from './geographic.module.js';
import { searchValidation } from './geographic.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { authorize } from '../auth/auth.middleware.js';
import { UserRole } from '../auth/auth.types.js';
import {
  getZonePermissions,
  addUserPermission,
  removeUserPermission,
  addGroupPermission,
  removeGroupPermission,
  updateZonePermissions,
} from './geographic.permissions.js';

const router = Router();

router.get('/busca', searchValidation, asyncHandler(searchGeographicNames));

router.put(
  '/zones/:zoneId/permissions',
  authorize([UserRole.ADMIN]),
  asyncHandler(updateZonePermissions),
);

router.get(
  '/zones/:zoneId/permissions',
  authorize([UserRole.ADMIN]),
  asyncHandler(getZonePermissions),
);

router.post(
  '/zones/:zoneId/permissions/users',
  authorize([UserRole.ADMIN]),
  asyncHandler(addUserPermission),
);

router.delete(
  '/zones/:zoneId/permissions/users/:userId',
  authorize([UserRole.ADMIN]),
  asyncHandler(removeUserPermission),
);

router.post(
  '/zones/:zoneId/permissions/groups',
  authorize([UserRole.ADMIN]),
  asyncHandler(addGroupPermission),
);

router.delete(
  '/zones/:zoneId/permissions/groups/:groupId',
  authorize([UserRole.ADMIN]),
  asyncHandler(removeGroupPermission),
);

export default router;
