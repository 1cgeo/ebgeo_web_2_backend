import { Router } from 'express';
import {
  login,
  logout,
  generateNewApiKey,
  getUserApiKey,
  createUser,
  validateApiKeyRequest,
} from './auth.module.js';
import {
  authenticateRequest,
  authorize,
  csrfProtection,
} from './auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from './auth.types.js';
import { loginValidation, createUserValidation } from './auth.validation.js';

const router = Router();

router.post('/login', loginValidation, asyncHandler(login));

// Rotas protegidas - requerem autenticação
router.use(authenticateRequest);
router.use(csrfProtection);

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

export default router;
