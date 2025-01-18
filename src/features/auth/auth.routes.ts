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
import { authorize } from './auth.middleware.js';

const router = Router();

// Rotas públicas
router.post('/login', loginValidation, asyncHandler(login));
router.get('/validate-api-key', asyncHandler(validateApiKey));

// Rotas que requerem autenticação
router.post('/logout', authorize(), asyncHandler(logout));
router.get('/api-key', authorize(), asyncHandler(getApiKey));
router.post('/api-key/regenerate', authorize(), asyncHandler(regenerateApiKey));
router.get('/api-key/history', authorize(), asyncHandler(getApiKeyHistory));

export default router;
