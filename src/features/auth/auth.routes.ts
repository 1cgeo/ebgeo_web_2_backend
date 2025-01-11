import { Router, Request, Response } from 'express';
import {
  login,
  logout,
  generateNewApiKey,
  getUserApiKey,
  createUser,
} from './auth.module.js';
import {
  authenticateJWT,
  authorize,
  rateLimiter,
  csrfProtection,
  generateToken,
} from './auth.middleware.js';
import {
  validateApiKeyRequest,
  updateModelPermissions,
  getModelPermissions,
} from './permissions.module.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from './auth.types.js';
import {
  loginValidation,
  createUserValidation,
  modelPermissionValidation,
} from './auth.validation.js';
import { ApiError } from '../../common/errors/apiError.js';

const router = Router();

// Aplicar rate limiting em todas as rotas de autenticação
router.use(rateLimiter);

// Rotas públicas
router.post('/login', loginValidation, asyncHandler(login));
router.post('/logout', asyncHandler(logout));

// Rotas protegidas - requerem autenticação
router.use(authenticateJWT);
router.use(csrfProtection);

// Rota de refresh token
router.post(
  '/refresh-token',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw ApiError.unauthorized('Token inválido ou expirado');
    }

    const token = generateToken({
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role,
      apiKey: req.user.apiKey,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutos
    });

    return res.json({ message: 'Token renovado com sucesso' });
  }),
);

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

// Rotas de gerenciamento de permissões (apenas admin)
router.put(
  '/models/:modelId/permissions',
  authorize([UserRole.ADMIN]),
  modelPermissionValidation,
  asyncHandler(updateModelPermissions),
);

router.get(
  '/models/:modelId/permissions',
  authorize([UserRole.ADMIN]),
  asyncHandler(getModelPermissions),
);

export default router;
