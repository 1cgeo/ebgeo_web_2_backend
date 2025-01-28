import { body, query, param } from 'express-validator';
import { UserRole } from '../auth/auth.types.js';

export const listUsersValidation = [
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
  query('search').optional().isString().trim(),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'all'])
    .withMessage('Status deve ser active, inactive ou all'),
  query('role')
    .optional()
    .isIn([...Object.values(UserRole), 'all'])
    .withMessage('Role deve ser admin, user ou all'),
  query('sort')
    .optional()
    .isIn([
      'username',
      'email',
      'role',
      'created_at',
      'last_login',
      'group_count',
    ])
    .withMessage('Campo de ordenação inválido'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direção de ordenação deve ser asc ou desc'),
];

export const createUserValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username é obrigatório')
    .isString()
    .withMessage('Username deve ser uma string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username deve ter entre 3 e 50 caracteres')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage(
      'Username deve conter apenas letras, números, underscores, pontos e hífens',
    ),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email é obrigatório')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email deve ter no máximo 255 caracteres'),

  body('nome_completo')
    .optional()
    .isString()
    .withMessage('Nome completo deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Nome completo deve ter no máximo 255 caracteres'),

  body('nome_guerra')
    .optional()
    .isString()
    .withMessage('Nome de guerra deve ser uma string')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Nome de guerra deve ter no máximo 50 caracteres'),

  body('organizacao_militar')
    .optional()
    .isString()
    .withMessage('Organização militar deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Organização militar deve ter no máximo 255 caracteres'),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isString()
    .withMessage('Senha deve ser uma string')
    .isLength({ min: 8, max: 100 })
    .withMessage('Senha deve ter entre 8 e 100 caracteres')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    )
    .withMessage(
      'Senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
    ),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role é obrigatória')
    .isIn(Object.values(UserRole))
    .withMessage('Role inválida'),

  body('groupIds')
    .optional()
    .isArray()
    .withMessage('groupIds deve ser um array')
    .custom((groupIds: string[]) => {
      if (!groupIds?.length) return true;
      return groupIds.every(id =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
      );
    })
    .withMessage('groupIds contém UUIDs inválidos'),
];

export const updateUserValidation = [
  param('id').isUUID().withMessage('ID do usuário inválido'),

  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email deve ter no máximo 255 caracteres'),

  body('nome_completo')
    .optional()
    .isString()
    .withMessage('Nome completo deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Nome completo deve ter no máximo 255 caracteres'),

  body('nome_guerra')
    .optional()
    .isString()
    .withMessage('Nome de guerra deve ser uma string')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Nome de guerra deve ter no máximo 50 caracteres'),

  body('organizacao_militar')
    .optional()
    .isString()
    .withMessage('Organização militar deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Organização militar deve ter no máximo 255 caracteres'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage('Role inválida'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser um booleano'),
];

export const updatePasswordValidation = [
  param('id').isUUID().withMessage('ID do usuário inválido'),

  body('currentPassword')
    .optional() // Opcional para admin
    .isString()
    .withMessage('Senha atual deve ser uma string'),

  body('newPassword')
    .notEmpty()
    .withMessage('Nova senha é obrigatória')
    .isString()
    .withMessage('Nova senha deve ser uma string')
    .isLength({ min: 8, max: 100 })
    .withMessage('Nova senha deve ter entre 8 e 100 caracteres')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    )
    .withMessage(
      'Nova senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
    ),
];

export const updateProfileValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email deve ter no máximo 255 caracteres'),

  body('nome_completo')
    .optional()
    .isString()
    .withMessage('Nome completo deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Nome completo deve ter no máximo 255 caracteres'),

  body('nome_guerra')
    .optional()
    .isString()
    .withMessage('Nome de guerra deve ser uma string')
    .trim()
    .isLength({ max: 50 })
    .withMessage('Nome de guerra deve ter no máximo 50 caracteres'),

  body('organizacao_militar')
    .optional()
    .isString()
    .withMessage('Organização militar deve ser uma string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Organização militar deve ter no máximo 255 caracteres'),
];
