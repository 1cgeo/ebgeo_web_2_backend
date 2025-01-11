import { body, ValidationChain, param } from 'express-validator';

export const createGroupValidation: ValidationChain[] = [
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
];

export const updateGroupValidation: ValidationChain[] = [
  param('groupId').isUUID().withMessage('ID do grupo deve ser um UUID válido'),

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
];
