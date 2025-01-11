import { body, ValidationChain } from 'express-validator';
import { UserRole } from './auth.types.js';

export const loginValidation: ValidationChain[] = [
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

export const createUserValidation: ValidationChain[] = [
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
      'Username deve conter apenas letras, números, underscore, ponto e hífen',
    ),

  body('password')
    .trim()
    .notEmpty()
    .withMessage('Senha é obrigatória')
    .isString()
    .withMessage('Senha deve ser uma string')
    .isLength({ min: 8, max: 100 })
    .withMessage('Senha deve ter entre 8 e 100 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Senha deve conter pelo menos uma letra maiúscula, uma minúscula, um número e um caractere especial',
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

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role é obrigatória')
    .isIn(Object.values(UserRole))
    .withMessage('Role inválida'),
];
