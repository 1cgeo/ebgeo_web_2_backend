import { query, body, param, ValidationChain } from 'express-validator';
import { LogCategory } from '../../common/config/logger.js';
import { UserRole } from '../auth/auth.types.js';

// Validações genéricas
const paginationValidation = [
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

// Validação para consulta de usuários
export const userListValidation: ValidationChain[] = [
  ...paginationValidation,

  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Termo de busca deve ter no mínimo 3 caracteres'),

  query('status')
    .optional()
    .isIn(['active', 'inactive', 'all'])
    .withMessage('Status deve ser active, inactive ou all'),

  query('role')
    .optional()
    .isIn([...Object.values(UserRole), 'all'])
    .withMessage('Role deve ser admin, user ou all'),
];

// Validação para atualização de usuário
export const userUpdateValidation: ValidationChain[] = [
  param('id').isUUID().withMessage('ID do usuário inválido'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage('Role deve ser admin ou user'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser um booleano'),

  body('password')
    .optional()
    .isString()
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais',
    ),
];

// Validação para consulta de logs
export const logQueryValidation: ValidationChain[] = [
  ...paginationValidation,

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial deve estar no formato ISO8601'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final deve estar no formato ISO8601'),

  query('level')
    .optional()
    .isIn(['ERROR', 'WARN', 'INFO', 'DEBUG'])
    .withMessage('Nível deve ser ERROR, WARN, INFO ou DEBUG'),

  query('category')
    .optional()
    .isIn(Object.values(LogCategory))
    .withMessage('Categoria inválida'),

  query('search').optional().isString().trim(),
];

// Validação para grupos
export const groupMembersValidation: ValidationChain[] = [
  ...paginationValidation,

  param('groupId').isUUID().withMessage('ID do grupo inválido'),
];

export const groupMembersUpdateValidation: ValidationChain[] = [
  param('groupId').isUUID().withMessage('ID do grupo inválido'),

  body('userIds')
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom((userIds: string[]) => {
      if (
        !userIds.every(id =>
          /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        )
      ) {
        throw new Error('Todos os userIds devem ser UUIDs válidos');
      }
      return true;
    }),
];
