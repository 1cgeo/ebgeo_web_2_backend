import { query, ValidationChain } from 'express-validator';
import { LogCategory } from '../../common/config/logger.js';
import { AuditAction } from './admin.types.js';

// Validação para consulta de logs
export const logQueryValidation: ValidationChain[] = [
  query('category')
    .optional()
    .isIn(Object.values(LogCategory))
    .withMessage('Categoria inválida'),

  query('level')
    .optional()
    .isIn(['ERROR', 'WARN', 'INFO', 'DEBUG'])
    .withMessage('Nível deve ser ERROR, WARN, INFO ou DEBUG'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limite deve ser entre 1 e 1000')
    .toInt(),
];

// Validação para consulta de auditoria
export const auditQueryValidation: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial deve estar no formato ISO8601'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final deve estar no formato ISO8601'),

  query('action')
    .optional()
    .isIn([
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_ROLE_CHANGE',
      'GROUP_CREATE',
      'GROUP_UPDATE',
      'GROUP_DELETE',
      'MODEL_PERMISSION_CHANGE',
      'ZONE_PERMISSION_CHANGE',
      'API_KEY_REGENERATE',
      'ADMIN_LOGIN',
      'ADMIN_ACTION',
    ] as AuditAction[])
    .withMessage('Ação inválida'),

  query('actorId')
    .optional()
    .isUUID()
    .withMessage('ID do ator deve ser um UUID válido'),

  query('targetId')
    .optional()
    .isUUID()
    .withMessage('ID do alvo deve ser um UUID válido'),

  query('search').optional().isString().trim(),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro maior que 0')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite deve ser entre 1 e 100')
    .toInt(),
];
