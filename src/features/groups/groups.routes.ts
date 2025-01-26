import { Router } from 'express';
import {
  createGroup,
  updateGroup,
  listGroups,
  deleteGroup,
  getGroupDetails,
} from './groups.module.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import {
  createGroupValidation,
  updateGroupValidation,
  listGroupsValidation,
} from './groups.validation.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

router.get(
  '/',
  authorize([UserRole.ADMIN]),
  validateRequest(listGroupsValidation),
  asyncHandler(listGroups),
);

router.get('/:id', authorize([UserRole.ADMIN]), asyncHandler(getGroupDetails));

router.post(
  '/',
  authorize([UserRole.ADMIN]),
  validateRequest(createGroupValidation),
  asyncHandler(createGroup),
);

router.put(
  '/:id',
  authorize([UserRole.ADMIN]),
  validateRequest(updateGroupValidation),
  asyncHandler(updateGroup),
);

router.delete('/:id', authorize([UserRole.ADMIN]), asyncHandler(deleteGroup));

export default router;
