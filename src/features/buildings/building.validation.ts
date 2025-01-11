import { query } from 'express-validator';

export const buildingSearchValidation = [
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
  query('z')
    .exists()
    .withMessage('Altitude é obrigatória')
    .isFloat()
    .withMessage('Altitude deve ser um número válido'),
];
