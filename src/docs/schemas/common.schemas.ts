import type { OpenAPISchema } from '../types/swagger.types.js';

export const commonSchemas: Record<string, OpenAPISchema> = {
  Error: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'error' },
      message: { type: 'string' },
      details: { type: 'object', nullable: true },
    },
  },
};
