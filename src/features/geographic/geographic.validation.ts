import { query } from 'express-validator';

export const searchValidation = [
  query('q')
    .exists()
    .withMessage('Termo de busca é obrigatório')
    .isString()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Busca deve ter pelo menos 3 caracteres'),
  query('lat')
    .exists()
    .withMessage('Latitude é obrigatória')
    .isFloat()
    .withMessage('Latitude deve ser um número válido'),
  query('lon')
    .exists()
    .withMessage('Longitude é obrigatória')
    .isFloat()
    .withMessage('Longitude deve ser um número válido'),
];
