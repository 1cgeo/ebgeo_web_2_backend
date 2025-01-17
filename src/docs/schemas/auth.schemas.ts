import type { OpenAPISchema } from '../types/swagger.types.js';

export const authSchemas: Record<string, OpenAPISchema> = {
  LoginRequest: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: {
        type: 'string',
        example: 'usuario',
      },
      password: {
        type: 'string',
        format: 'password',
        example: 'senha123',
      },
    },
  },
  LoginResponse: {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] },
        },
      },
      token: { type: 'string' },
    },
  },
};
