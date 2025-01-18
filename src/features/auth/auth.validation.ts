import { body } from 'express-validator';

export const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username é obrigatório')
    .isString()
    .withMessage('Username deve ser uma string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username deve ter entre 3 e 50 caracteres'),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isString()
    .withMessage('Senha deve ser uma string')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter no mínimo 6 caracteres'),
];
