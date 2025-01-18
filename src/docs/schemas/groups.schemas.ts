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

  GroupDetails: {
    type: 'object',
    required: [
      'id',
      'name',
      'createdBy',
      'createdAt',
      'updatedAt',
      'memberCount',
      'modelPermissions',
      'zonePermissions',
      'members',
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
      createdBy: {
        type: 'string',
        format: 'uuid',
      },
      createdByName: {
        type: 'string',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
      memberCount: {
        type: 'integer',
      },
      modelPermissions: {
        type: 'integer',
      },
      zonePermissions: {
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

  GroupList: {
    type: 'object',
    required: ['groups', 'total', 'page', 'limit'],
    properties: {
      groups: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GroupDetails',
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
