import { Router } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { getUserGroups, createGroup, updateGroup } from './groups.module.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import {
  CreateGroupBody,
  UpdateGroupBody,
  UpdateGroupParams,
} from './groups.types.js';
import {
  createGroupValidation,
  updateGroupValidation,
} from './groups.validation.js';

const router = Router();

router.get(
  '/groups',
  authorize([UserRole.USER, UserRole.ADMIN]),
  asyncHandler(getUserGroups),
);

router.post(
  '/groups',
  authorize<ParamsDictionary, unknown, CreateGroupBody>([UserRole.ADMIN]),
  createGroupValidation,
  asyncHandler<ParamsDictionary, unknown, CreateGroupBody>(createGroup),
);

// Note que o Express infere o tipo do parâmetro da URL (:groupId)
router.put<UpdateGroupParams, unknown, UpdateGroupBody>(
  '/groups/:groupId',
  authorize<UpdateGroupParams, unknown, UpdateGroupBody>([UserRole.ADMIN]),
  updateGroupValidation,
  asyncHandler(updateGroup),
);

export default router;
