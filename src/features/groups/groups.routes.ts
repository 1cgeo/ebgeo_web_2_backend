import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  listGroups,
  deleteGroup,
} from './groups.module.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import {
  createGroupValidation,
  updateGroupValidation,
  listGroupsValidation,
} from './groups.validation.js';

const router = Router();

router.get(
  '/groups',
  authorize([UserRole.ADMIN]),
  listGroupsValidation,
  asyncHandler(listGroups),
);

router.post(
  '/groups',
  authorize([UserRole.ADMIN]),
  createGroupValidation,
  asyncHandler(createGroup),
);

router.put(
  '/groups/:id',
  authorize([UserRole.ADMIN]),
  updateGroupValidation,
  asyncHandler(updateGroup),
);

router.delete(
  '/groups/:id',
  authorize([UserRole.ADMIN]),
  asyncHandler(deleteGroup),
);

export default router;
