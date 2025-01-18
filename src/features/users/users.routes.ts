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

const router = Router();

// Rotas administrativas (requer ADMIN)
router.get(
  '/',
  authorize([UserRole.ADMIN]),
  listUsersValidation,
  asyncHandler(listUsers),
);

router.get('/:id', authorize([UserRole.ADMIN]), asyncHandler(getUserDetails));

router.post(
  '/',
  authorize([UserRole.ADMIN]),
  createUserValidation,
  asyncHandler(createUser),
);

router.put(
  '/:id',
  authorize([UserRole.ADMIN]),
  updateUserValidation,
  asyncHandler(updateUser),
);

// Rotas de perfil (qualquer usuário autenticado)
router.get(
  '/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(getUserProfile),
);

router.put(
  '/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  updateProfileValidation,
  asyncHandler(updateProfile),
);

// Rota de alteração de senha (admin ou próprio usuário)
router.put(
  '/:id/password',
  authorize([UserRole.ADMIN, UserRole.USER]),
  updatePasswordValidation,
  asyncHandler(updatePassword),
);

export default router;
