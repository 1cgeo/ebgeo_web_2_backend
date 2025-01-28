import type { OpenAPISchema } from '../types/swagger.types.js';

export const geographicSchemas: Record<string, OpenAPISchema> = {
  GeographicName: {
    type: 'object',
    properties: {
      nome: { type: 'string' },
      longitude: { type: 'number', format: 'float' },
      latitude: { type: 'number', format: 'float' },
      municipio: { type: 'string', nullable: true },
      estado: { type: 'string', nullable: true },
      tipo: { type: 'string', nullable: true },
      name_similarity: { type: 'number', format: 'float' },
      distance_to_center: { type: 'number', format: 'float' },
      relevance_score: { type: 'number', format: 'float' },
      access_level: {
        type: 'string',
        enum: ['public', 'private'],
      },
    },
  },

  GeographicZone: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      area_km2: { type: 'number', format: 'float' },
      user_count: { type: 'integer' },
      group_count: { type: 'integer' },
      created_at: { type: 'string', format: 'date-time' },
      created_by: { type: 'string', format: 'uuid' },
    },
  },

  ZonePermissions: {
    type: 'object',
    properties: {
      zone_id: { type: 'string', format: 'uuid' },
      zone_name: { type: 'string' },
      user_permissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
          },
        },
      },
      group_permissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
      },
    },
  },

  CreateZoneRequest: {
    type: 'object',
    required: ['name', 'geom'],
    properties: {
      name: { type: 'string', minLength: 3, maxLength: 100 },
      description: { type: 'string', maxLength: 500, nullable: true },
      geom: {
        type: 'object',
        description: 'GeoJSON geometry object',
      },
      userIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        nullable: true,
      },
      groupIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        nullable: true,
      },
    },
  },

  UpdateZonePermissionsRequest: {
    type: 'object',
    required: ['userIds', 'groupIds'],
    properties: {
      userIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
      },
      groupIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
      },
    },
  },

  ZoneListResponse: {
    type: 'object',
    required: ['zones', 'total', 'page', 'limit'],
    properties: {
      zones: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GeographicZone',
        },
      },
      total: {
        type: 'integer',
        description: 'Total de zonas',
      },
      page: {
        type: 'integer',
        description: 'Página atual',
      },
      limit: {
        type: 'integer',
        description: 'Itens por página',
      },
    },
  },
};
