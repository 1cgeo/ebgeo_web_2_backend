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
  '/users',
  authorize([UserRole.ADMIN]),
  listUsersValidation,
  asyncHandler(listUsers),
);

router.get(
  '/users/:id',
  authorize([UserRole.ADMIN]),
  asyncHandler(getUserDetails),
);

router.post(
  '/users',
  authorize([UserRole.ADMIN]),
  createUserValidation,
  asyncHandler(createUser),
);

router.put(
  '/users/:id',
  authorize([UserRole.ADMIN]),
  updateUserValidation,
  asyncHandler(updateUser),
);

// Rotas de perfil (qualquer usuário autenticado)
router.get(
  '/users/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(getUserProfile),
);

router.put(
  '/users/me',
  authorize([UserRole.ADMIN, UserRole.USER]),
  updateProfileValidation,
  asyncHandler(updateProfile),
);

// Rota de alteração de senha (admin ou próprio usuário)
router.put(
  '/users/:id/password',
  authorize([UserRole.ADMIN, UserRole.USER]),
  updatePasswordValidation,
  asyncHandler(updatePassword),
);

export default router;
