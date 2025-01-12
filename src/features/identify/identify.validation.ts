import { query, ValidationChain } from 'express-validator';

export const identifyValidation: ValidationChain[] = [
  query('lat')
    .exists()
    .withMessage('Latitude é obrigatória')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude deve estar entre -90 e 90 graus')
    .toFloat(),

  query('lon')
    .exists()
    .withMessage('Longitude é obrigatória')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude deve estar entre -180 e 180 graus')
    .toFloat(),

  query('z')
    .exists()
    .withMessage('Altitude é obrigatória')
    .isFloat()
    .withMessage('Altitude deve ser um número válido')
    .toFloat(),
];

// Adicionar validação específica para queries espaciais
export const validateSpatialPoint = (
  lat: number,
  lon: number,
  z: number,
): boolean => {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    !isNaN(z) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};
