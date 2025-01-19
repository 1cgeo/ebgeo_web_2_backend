import { Router } from 'express';
import {
  searchGeographicNames,
  listZones,
  getZonePermissions,
  createZone,
  updateZonePermissions,
  deleteZone,
} from './geographic.module.js';
import {
  searchValidation,
  createZoneValidation,
  updateZonePermissionsValidation,
} from './geographic.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { authorize } from '../auth/auth.middleware.js';
import { UserRole } from '../auth/auth.types.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

// Rota de busca de nomes geográficos (pública com autenticação opcional)
router.get(
  '/busca',
  validateRequest(searchValidation),
  asyncHandler(searchGeographicNames),
);

// Rotas de gerenciamento de zonas (admin only)
router.get('/zones', authorize([UserRole.ADMIN]), asyncHandler(listZones));

router.get(
  '/zones/:zoneId/permissions',
  authorize([UserRole.ADMIN]),
  asyncHandler(getZonePermissions),
);

router.post(
  '/zones',
  authorize([UserRole.ADMIN]),
  validateRequest(createZoneValidation),
  asyncHandler(createZone),
);

router.put(
  '/zones/:zoneId/permissions',
  authorize([UserRole.ADMIN]),
  validateRequest(updateZonePermissionsValidation),
  asyncHandler(updateZonePermissions),
);

router.delete(
  '/zones/:zoneId',
  authorize([UserRole.ADMIN]),
  asyncHandler(deleteZone),
);

export default router;
