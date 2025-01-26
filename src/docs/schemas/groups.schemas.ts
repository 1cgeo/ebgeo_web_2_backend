import type { OpenAPISchema } from '../types/swagger.types.js';

export const groupSchemas: Record<string, OpenAPISchema> = {
  CreateGroupDTO: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 100,
        pattern: '^[a-zA-Z0-9_\\-\\s]+$',
        description: 'Nome do grupo',
      },
      description: {
        type: 'string',
        maxLength: 500,
        description: 'Descrição do grupo',
      },
      userIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        description: 'IDs dos usuários a serem adicionados ao grupo',
      },
    },
  },

  UpdateGroupDTO: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        maxLength: 100,
        pattern: '^[a-zA-Z0-9_\\-\\s]+$',
        description: 'Novo nome do grupo',
      },
      description: {
        type: 'string',
        maxLength: 500,
        description: 'Nova descrição do grupo',
      },
      userIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        description: 'Lista atualizada de IDs dos usuários do grupo',
      },
    },
  },

  GroupMember: {
    type: 'object',
    required: ['id', 'username', 'addedAt', 'addedBy'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      username: {
        type: 'string',
      },
      addedAt: {
        type: 'string',
        format: 'date-time',
      },
      addedBy: {
        type: 'string',
      },
    },
  },

  ModelPermission: {
    type: 'object',
    required: ['id', 'name', 'type', 'access_level'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      type: {
        type: 'string',
      },
      access_level: {
        type: 'string',
        enum: ['public', 'private'],
      },
    },
  },

  ZonePermission: {
    type: 'object',
    required: ['id', 'name', 'area_km2'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      area_km2: {
        type: 'number',
        format: 'float',
      },
    },
  },

  GroupSummary: {
    type: 'object',
    required: [
      'id',
      'name',
      'created_by',
      'created_at',
      'updated_at',
      'member_count',
      'model_permissions_count',
      'zone_permissions_count',
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      description: {
        type: 'string',
      },
      created_by: {
        type: 'string',
        format: 'uuid',
      },
      created_by_name: {
        type: 'string',
      },
      created_at: {
        type: 'string',
        format: 'date-time',
      },
      updated_at: {
        type: 'string',
        format: 'date-time',
      },
      member_count: {
        type: 'integer',
      },
      model_permissions_count: {
        type: 'integer',
      },
      zone_permissions_count: {
        type: 'integer',
      },
      members: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GroupMember',
        },
      },
    },
  },

  GroupDetails: {
    type: 'object',
    required: [
      'id',
      'name',
      'created_by',
      'created_at',
      'updated_at',
      'member_count',
    ],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
      },
      description: {
        type: 'string',
      },
      created_by: {
        type: 'string',
        format: 'uuid',
      },
      created_by_name: {
        type: 'string',
      },
      created_at: {
        type: 'string',
        format: 'date-time',
      },
      updated_at: {
        type: 'string',
        format: 'date-time',
      },
      member_count: {
        type: 'integer',
      },
      members: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GroupMember',
        },
      },
      model_permissions: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ModelPermission',
        },
      },
      zone_permissions: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ZonePermission',
        },
      },
    },
  },

  GroupList: {
    type: 'object',
    required: ['groups', 'total', 'page', 'limit'],
    properties: {
      groups: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GroupSummary',
        },
      },
      total: {
        type: 'integer',
        description: 'Total de grupos',
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
