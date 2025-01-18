import { Router } from 'express';
import {
  getSystemHealth,
  getSystemMetrics,
  queryLogs,
  queryAudit,
} from './admin.module.js';
import {
  logQueryValidation,
  auditQueryValidation,
} from './admin.validation.js';
import { authorize } from '../auth/auth.middleware.js';
import { asyncHandler } from '../../common/middleware/asyncHandler.js';
import { UserRole } from '../auth/auth.types.js';

const router = Router();

// Health check e métricas
router.get(
  '/health',
  authorize([UserRole.ADMIN]),
  asyncHandler(getSystemHealth),
);
router.get(
  '/metrics',
  authorize([UserRole.ADMIN]),
  asyncHandler(getSystemMetrics),
);

// Logs
router.get(
  '/logs',
  authorize([UserRole.ADMIN]),
  logQueryValidation,
  asyncHandler(queryLogs),
);

// Trilha de auditoria
router.get(
  '/audit',
  authorize([UserRole.ADMIN]),
  auditQueryValidation,
  asyncHandler(queryAudit),
);

export default router;
