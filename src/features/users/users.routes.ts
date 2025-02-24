import { Router } from 'express';
import {
  listUsers,
  getUserDetails,
  createUser,
  updateUser,
  updatePassword,
  getUserProfile,
  updateProfile,
} from './users.module.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';
import {
  listUsersValidation,
  createUserValidation,
  updateUserValidation,
  updatePasswordValidation,
  updateProfileValidation,
} from './users.validation.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

router.get(
  '/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(getUserProfile),
);

router.put(
  '/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  validateRequest(updateProfileValidation),
  asyncHandler(updateProfile),
);

router.get(
  '/',
  authorize([UserRole.ADMIN]),
  validateRequest(listUsersValidation),
  asyncHandler(listUsers),
);

router.post(
  '/',
  authorize([UserRole.ADMIN]),
  validateRequest(createUserValidation),
  asyncHandler(createUser),
);

router.get('/:id', authorize([UserRole.ADMIN]), asyncHandler(getUserDetails));

router.put(
  '/:id',
  authorize([UserRole.ADMIN]),
  validateRequest(updateUserValidation),
  asyncHandler(updateUser),
);

// Rota de alteração de senha (admin ou próprio usuário)
router.put(
  '/:id/password',
  authorize([UserRole.ADMIN, UserRole.USER]),
  validateRequest(updatePasswordValidation),
  asyncHandler(updatePassword),
);

export default router;
