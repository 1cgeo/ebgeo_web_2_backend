import { body, query, param } from 'express-validator';

export const listGroupsValidation = [
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
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Termo de busca deve ter no mínimo 3 caracteres'),
  query('sort')
    .optional()
    .isIn([
      'name',
      'created_at',
      'updated_at',
      'member_count',
      'model_permissions_count',
      'zone_permissions_count',
    ])
    .withMessage('Campo de ordenação inválido'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direção de ordenação deve ser asc ou desc'),
];

export const createGroupValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nome do grupo é obrigatório')
    .isString()
    .withMessage('Nome do grupo deve ser uma string')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome do grupo deve ter entre 3 e 100 caracteres')
    .matches(/^[a-zA-Z0-9_\-\s]+$/)
    .withMessage(
      'Nome do grupo deve conter apenas letras, números, underscores e hífens',
    ),

  body('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Descrição deve ser uma string')
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres'),

  body('userIds')
    .optional()
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom((userIds: string[]) => {
      if (!userIds?.length) return true;
      return userIds.every(id =>
        /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
      );
    })
    .withMessage('userIds contém UUIDs inválidos'),
];

export const updateGroupValidation = [
  param('id').isUUID().withMessage('ID do grupo inválido'),

  body('name')
    .optional()
    .trim()
    .isString()
    .withMessage('Nome do grupo deve ser uma string')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome do grupo deve ter entre 3 e 100 caracteres')
    .matches(/^[a-zA-Z0-9_\-\s]+$/)
    .withMessage(
      'Nome do grupo deve conter apenas letras, números, underscores e hífens',
    ),

  body('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Descrição deve ser uma string')
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres'),

  body('userIds')
    .optional()
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom((userIds: string[]) => {
      if (!userIds?.length) return true;
      return userIds.every(id =>
        /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
      );
    })
    .withMessage('userIds contém UUIDs inválidos'),
];

export const validateUUIDParam = [
  param('id').isUUID().withMessage('ID do grupo inválido'),
];
