import { Router } from 'express';
import {
  login,
  logout,
  getApiKey,
  regenerateApiKey,
  getApiKeyHistory,
  validateApiKey,
} from './auth.module.js';
import { loginValidation } from './auth.validation.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { authenticateRequest, authorize } from './auth.middleware.js';
import { UserRole } from './auth.types.js';
import { validateRequest } from '../../common/middleware/validateRequest.js';

const router = Router();

// Rotas públicas
router.post('/login', validateRequest(loginValidation), asyncHandler(login));
router.get('/validate-api-key', asyncHandler(validateApiKey));

// Rotas que requerem autenticação
router.post(
  '/logout',
  authenticateRequest,
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(logout),
);
router.get(
  '/api-key',
  authenticateRequest,
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(getApiKey),
);
router.post(
  '/api-key/regenerate',
  authenticateRequest,
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(regenerateApiKey),
);
router.get(
  '/api-key/history',
  authenticateRequest,
  authorize([UserRole.ADMIN, UserRole.USER]),
  asyncHandler(getApiKeyHistory),
);

export default router;
