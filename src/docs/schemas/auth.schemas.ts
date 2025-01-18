// src/docs/schemas/auth.schemas.ts
import type { OpenAPISchema } from '../types/swagger.types.js';

export const authSchemas: Record<string, OpenAPISchema> = {
  LoginRequest: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 50,
        description: 'Nome de usuário',
        example: 'johndoe',
      },
      password: {
        type: 'string',
        format: 'password',
        minLength: 6,
        description: 'Senha do usuário',
        example: '********',
      },
    },
  },

  LoginResponse: {
    type: 'object',
    required: ['user', 'token'],
    properties: {
      user: {
        type: 'object',
        required: ['id', 'username', 'email', 'role'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'ID do usuário',
          },
          username: {
            type: 'string',
            description: 'Nome de usuário',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Email do usuário',
          },
          role: {
            type: 'string',
            enum: ['admin', 'user'],
            description: 'Papel do usuário',
          },
        },
      },
      token: {
        type: 'string',
        description: 'JWT token para autenticação',
      },
    },
  },

  ApiKeyResponse: {
    type: 'object',
    required: ['apiKey', 'generatedAt'],
    properties: {
      apiKey: {
        type: 'string',
        format: 'uuid',
        description: 'API key atual do usuário',
      },
      generatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Data de geração da API key',
      },
    },
  },

  ApiKeyHistoryEntry: {
    type: 'object',
    required: ['apiKey', 'createdAt', 'isActive'],
    properties: {
      apiKey: {
        type: 'string',
        format: 'uuid',
        description: 'API key',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Data de criação',
      },
      revokedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Data de revogação, se aplicável',
      },
      isActive: {
        type: 'boolean',
        description: 'Se a API key ainda está ativa',
      },
    },
  },

  ApiKeyHistoryResponse: {
    type: 'object',
    required: ['userId', 'history'],
    properties: {
      userId: {
        type: 'string',
        format: 'uuid',
        description: 'ID do usuário',
      },
      history: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ApiKeyHistoryEntry',
        },
        description: 'Histórico de API keys',
      },
    },
  },

  ValidationResponse: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        description: 'Mensagem indicando o resultado da validação',
      },
    },
    example: {
      message: 'API key válida',
    },
  },
};
