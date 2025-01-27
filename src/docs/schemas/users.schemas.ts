import type { OpenAPISchema } from '../types/swagger.types.js';

export const userSchemas: Record<string, OpenAPISchema> = {
  Role: {
    type: 'string',
    enum: ['admin', 'user'],
    description: 'Papel do usuário no sistema',
  },

  BaseUser: {
    type: 'object',
    required: ['id', 'username', 'email', 'role', 'isActive'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Identificador único do usuário',
      },
      username: {
        type: 'string',
        description: 'Nome de usuário',
        example: 'johndoe',
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Email do usuário',
        example: 'john@example.com',
      },
      nome_completo: {
        type: 'string',
        description: 'Nome completo do usuário',
        example: 'João da Silva Santos',
        maxLength: 255,
      },
      nome_guerra: {
        type: 'string',
        description: 'Nome de guerra do usuário',
        example: 'SILVA',
        maxLength: 50,
      },
      organizacao_militar: {
        type: 'string',
        description: 'Organização militar do usuário',
        example: '1º BIS',
        maxLength: 255,
      },
      role: {
        $ref: '#/components/schemas/Role',
      },
      isActive: {
        type: 'boolean',
        description: 'Se o usuário está ativo',
      },
      lastLogin: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Data do último login',
      },
    },
  },

  UserGroup: {
    type: 'object',
    required: ['id', 'name', 'addedAt', 'addedBy'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
        description: 'Nome do grupo',
      },
      addedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Data de adição ao grupo',
      },
      addedBy: {
        type: 'string',
        description: 'Username de quem adicionou ao grupo',
      },
    },
  },

  UserPermission: {
    type: 'object',
    required: ['id', 'name', 'accessType'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
      name: {
        type: 'string',
        description: 'Nome do recurso',
      },
      accessType: {
        type: 'string',
        enum: ['direct', 'group'],
        description: 'Tipo de acesso (direto ou via grupo)',
      },
      groupId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'ID do grupo quando acesso é via grupo',
      },
    },
  },

  UserPermissions: {
    type: 'object',
    required: ['models', 'zones'],
    properties: {
      models: {
        type: 'object',
        required: ['count', 'items'],
        properties: {
          count: {
            type: 'integer',
            description: 'Total de modelos com acesso',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UserPermission',
            },
          },
        },
      },
      zones: {
        type: 'object',
        required: ['count', 'items'],
        properties: {
          count: {
            type: 'integer',
            description: 'Total de zonas com acesso',
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UserPermission',
            },
          },
        },
      },
    },
  },

  UserDetails: {
    allOf: [
      { $ref: '#/components/schemas/BaseUser' },
      {
        type: 'object',
        required: ['groups', 'permissions'],
        properties: {
          groups: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UserGroup',
            },
          },
          permissions: {
            $ref: '#/components/schemas/UserPermissions',
          },
        },
      },
    ],
  },

  CreateUserDTO: {
    type: 'object',
    required: ['username', 'email', 'password', 'role'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: '^[a-zA-Z0-9_.-]+$',
        description: 'Nome de usuário (letras, números, _, ., -)',
        example: 'john.doe',
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        description: 'Email do usuário',
        example: 'john@example.com',
      },
      nome_completo: {
        type: 'string',
        maxLength: 255,
        description: 'Nome completo do usuário',
      },
      nome_guerra: {
        type: 'string',
        maxLength: 50,
        description: 'Nome de guerra do usuário',
      },
      organizacao_militar: {
        type: 'string',
        maxLength: 255,
        description: 'Organização militar do usuário',
      },
      password: {
        type: 'string',
        format: 'password',
        minLength: 8,
        description:
          'Senha (min 8 chars, maiúscula, minúscula, número, especial)',
      },
      role: {
        $ref: '#/components/schemas/Role',
      },
      groupIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        description: 'IDs dos grupos para adicionar o usuário',
      },
    },
  },

  UpdateUserDTO: {
    type: 'object',
    minProperties: 1,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      nome_completo: {
        type: 'string',
        maxLength: 255,
      },
      nome_guerra: {
        type: 'string',
        maxLength: 50,
      },
      organizacao_militar: {
        type: 'string',
        maxLength: 255,
      },
      role: {
        $ref: '#/components/schemas/Role',
      },
      isActive: {
        type: 'boolean',
      },
    },
  },

  UpdatePasswordDTO: {
    type: 'object',
    required: ['newPassword'],
    properties: {
      currentPassword: {
        type: 'string',
        format: 'password',
        description: 'Senha atual (obrigatória exceto para admin)',
      },
      newPassword: {
        type: 'string',
        format: 'password',
        minLength: 8,
        description: 'Nova senha',
      },
    },
  },
  UpdateProfileDTO: {
    type: 'object',
    required: ['email'],
    properties: {
      email: {
        type: 'string',
        format: 'email',
        maxLength: 255,
      },
      nome_completo: {
        type: 'string',
        maxLength: 255,
      },
      nome_guerra: {
        type: 'string',
        maxLength: 50,
      },
      organizacao_militar: {
        type: 'string',
        maxLength: 255,
      },
    },
  },
  UserWithGroups: {
    allOf: [
      { $ref: '#/components/schemas/BaseUser' },
      {
        type: 'object',
        required: ['group_count', 'groups'],
        properties: {
          group_count: {
            type: 'integer',
          },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid',
                },
                name: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    ],
  },
  UserListResponse: {
    type: 'object',
    required: ['users', 'total', 'page', 'limit'],
    properties: {
      users: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/UserWithGroups',
        },
      },
      total: {
        type: 'integer',
        description: 'Total de usuários',
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
