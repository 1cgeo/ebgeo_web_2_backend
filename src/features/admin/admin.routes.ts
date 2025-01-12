import { Router } from 'express';
import {
  listUsers,
  updateUser,
  getGroupMembers,
  queryLogs,
  exportLogs,
  getSystemMetrics,
} from './admin.module.js';
import {
  userListValidation,
  userUpdateValidation,
  groupMembersValidation,
  logQueryValidation,
} from './admin.validation.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';

const router = Router();

router.get(
  '/users',
  userListValidation,
  authorize([UserRole.ADMIN]),
  asyncHandler(listUsers),
);

router.put(
  '/users/:id',
  userUpdateValidation,
  authorize([UserRole.ADMIN]),
  asyncHandler(updateUser),
);

router.get(
  '/groups/:groupId/members',
  groupMembersValidation,
  authorize([UserRole.ADMIN]),
  asyncHandler(getGroupMembers),
);

router.get(
  '/logs',
  logQueryValidation,
  authorize([UserRole.ADMIN]),
  asyncHandler(queryLogs),
);

router.get(
  '/logs/export',
  logQueryValidation,
  authorize([UserRole.ADMIN]),
  asyncHandler(exportLogs),
);

router.get('/metrics', asyncHandler(getSystemMetrics));

export default router;
