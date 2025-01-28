import { query, body, ValidationChain, param } from 'express-validator';

export const searchValidation: ValidationChain[] = [
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
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude deve estar entre -90 e 90 graus'),
  query('lon')
    .exists()
    .withMessage('Longitude é obrigatória')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude deve estar entre -180 e 180 graus'),
];

const validateGeoJSON = (geom: any): boolean => {
  try {
    if (typeof geom !== 'object') return false;
    if (geom.type !== 'Polygon') return false;
    if (!Array.isArray(geom.coordinates)) return false;
    if (!Array.isArray(geom.coordinates[0])) return false;

    // Validar se é um polígono válido (primeiro e último ponto iguais)
    const ring = geom.coordinates[0];
    if (!Array.isArray(ring) || ring.length < 4) return false;

    // Verificar se todos os pontos são coordenadas válidas
    return ring.every(
      (point: any) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number',
    );
  } catch {
    return false;
  }
};

export const createZoneValidation: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nome da zona é obrigatório')
    .isString()
    .withMessage('Nome deve ser uma string')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nome deve ter entre 3 e 100 caracteres'),

  body('description')
    .optional()
    .trim()
    .isString()
    .withMessage('Descrição deve ser uma string')
    .isLength({ max: 500 })
    .withMessage('Descrição deve ter no máximo 500 caracteres'),

  body('geom')
    .notEmpty()
    .withMessage('Geometria é obrigatória')
    .custom(value => {
      if (!validateGeoJSON(value)) {
        throw new Error(
          'Geometria inválida: deve ser um GeoJSON Polygon válido',
        );
      }
      return true;
    }),

  body('userIds')
    .optional()
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom(value => {
      if (
        !value.every((id: string) =>
          /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        )
      ) {
        throw new Error('Todos os userIds devem ser UUIDs válidos');
      }
      return true;
    }),

  body('groupIds')
    .optional()
    .isArray()
    .withMessage('groupIds deve ser um array')
    .custom(value => {
      if (
        !value.every((id: string) =>
          /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        )
      ) {
        throw new Error('Todos os groupIds devem ser UUIDs válidos');
      }
      return true;
    }),
];

export const updateZonePermissionsValidation: ValidationChain[] = [
  param('id').isUUID().withMessage('ID do grupo inválido'),

  body('userIds')
    .isArray()
    .withMessage('userIds deve ser um array')
    .custom(value => {
      if (
        !value.every((id: string) =>
          /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        )
      ) {
        throw new Error('Todos os userIds devem ser UUIDs válidos');
      }
      return true;
    }),

  body('groupIds')
    .isArray()
    .withMessage('groupIds deve ser um array')
    .custom(value => {
      if (
        !value.every((id: string) =>
          /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id),
        )
      ) {
        throw new Error('Todos os groupIds devem ser UUIDs válidos');
      }
      return true;
    }),
];

export const listZonesValidation = [
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
    .isIn(['name', 'created_at', 'area', 'user_count', 'group_count'])
    .withMessage('Campo de ordenação inválido'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Direção de ordenação deve ser asc ou desc'),
];

export const validateUUIDParam = [
  param('id').isUUID().withMessage('ID do grupo inválido'),
];
