import { query } from 'express-validator';

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
