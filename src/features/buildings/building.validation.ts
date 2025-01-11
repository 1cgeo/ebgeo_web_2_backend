import { query } from 'express-validator';

export const buildingSearchValidation = [
  query('lat')
    .exists()
    .withMessage('Latitude é obrigatória')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude deve estar entre -90 e 90 graus'),
  query('lon')
    .exists()
    .withMessage('Longitude é obrigatória')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude deve estar entre -180 e 180 graus'),
  query('z')
    .exists()
    .withMessage('Altitude é obrigatória')
    .isFloat()
    .withMessage('Altitude deve ser um número válido'),
];
