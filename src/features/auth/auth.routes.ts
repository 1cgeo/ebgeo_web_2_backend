import { Router } from 'express';
import {
  login,
  logout,
  generateNewApiKey,
  getUserApiKey,
  createUser,
  validateApiKeyRequest,
  getApiKeyHistory,
  getUserDetails,
  updateUser,
} from './auth.module.js';
import { authorize } from './auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from './auth.types.js';
import {
  loginValidation,
  createUserValidation,
  updateUserValidation,
} from './auth.validation.js';

const router = Router();

router.post('/login', loginValidation, asyncHandler(login));

router.post('/logout', asyncHandler(logout));

// Rota para validação de API key (nginx auth_request)
router.get('/validate-api-key', asyncHandler(validateApiKeyRequest));

// Rotas para usuários autenticados
router.get(
  '/api-key',
  authorize([UserRole.USER, UserRole.ADMIN]),
  asyncHandler(getUserApiKey),
);

router.post(
  '/api-key/regenerate',
  authorize([UserRole.USER, UserRole.ADMIN]),
  asyncHandler(generateNewApiKey),
);

// Rotas administrativas
router.post(
  '/users',
  authorize([UserRole.ADMIN]),
  createUserValidation,
  asyncHandler(createUser),
);

// Rota de histórico de API keys
router.get(
  '/api-key/history',
  authorize([UserRole.USER, UserRole.ADMIN]),
  asyncHandler(getApiKeyHistory),
);

router.get(
  '/users/:id',
  authorize([UserRole.ADMIN]),
  asyncHandler(getUserDetails),
);

router.put(
  '/users/:id',
  authorize([UserRole.ADMIN]),
  updateUserValidation,
  asyncHandler(updateUser),
);

export default router;
