import { body, query, param } from 'express-validator';

export const searchValidation = [
  query('q').optional().isString().trim().escape(),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro positivo')
    .toInt(),
  query('nr_records')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Número de registros deve estar entre 1 e 100')
    .toInt(),
];

export const updatePermissionsValidation = [
  param('id').isUUID().withMessage('ID do grupo inválido'),

  body('access_level')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('Nível de acesso deve ser public ou private'),

  body('userIds')
    .optional()
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom(value => {
      if (!value) return true;
      return value.every((id: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        );
      });
    })
    .withMessage('Todos os userIds devem ser UUIDs válidos'),

  body('groupIds')
    .optional()
    .isArray()
    .withMessage('groupIds deve ser um array')
    .custom(value => {
      if (!value) return true;
      return value.every((id: string) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        );
      });
    })
    .withMessage('Todos os groupIds devem ser UUIDs válidos'),
];

export const listModelPermissionsValidation = [
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
    .isIn(['name', 'created_at', 'access_level', 'user_count', 'group_count'])
    .withMessage('Campo de ordenação inválido'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direção de ordenação deve ser asc ou desc'),
];

export const validateUUIDParam = [
  param('id').isUUID().withMessage('ID do grupo inválido'),
];
