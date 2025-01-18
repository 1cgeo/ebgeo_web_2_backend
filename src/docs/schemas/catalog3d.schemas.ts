import type { OpenAPISchema } from '../types/swagger.types.js';

export const catalog3dSchemas: Record<string, OpenAPISchema> = {
  Catalog3DModel: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string', nullable: true },
      thumbnail: { type: 'string', nullable: true },
      url: { type: 'string' },
      lon: { type: 'number', format: 'float', nullable: true },
      lat: { type: 'number', format: 'float', nullable: true },
      height: { type: 'number', format: 'float', nullable: true },
      heading: { type: 'number', format: 'float', nullable: true },
      pitch: { type: 'number', format: 'float', nullable: true },
      roll: { type: 'number', format: 'float', nullable: true },
      type: { type: 'string' },
      heightoffset: { type: 'number', format: 'float', nullable: true },
      maximumscreenspaceerror: {
        type: 'number',
        format: 'float',
        nullable: true,
      },
      data_criacao: { type: 'string', format: 'date-time' },
      data_carregamento: { type: 'string', format: 'date-time' },
      municipio: { type: 'string', nullable: true },
      estado: { type: 'string', nullable: true },
      palavras_chave: {
        type: 'array',
        items: { type: 'string' },
        nullable: true,
      },
      access_level: {
        type: 'string',
        enum: ['public', 'private'],
      },
    },
  },

  Catalog3DSearchResponse: {
    type: 'object',
    properties: {
      total: { type: 'integer' },
      page: { type: 'integer' },
      nr_records: { type: 'integer' },
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/Catalog3DModel' },
      },
    },
  },

  ModelPermissions: {
    type: 'object',
    properties: {
      model_id: { type: 'string', format: 'uuid' },
      model_name: { type: 'string' },
      access_level: {
        type: 'string',
        enum: ['public', 'private'],
      },
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

  UpdateModelPermissionsRequest: {
    type: 'object',
    properties: {
      access_level: {
        type: 'string',
        enum: ['public', 'private'],
      },
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
};
