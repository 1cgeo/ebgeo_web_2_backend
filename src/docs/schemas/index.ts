import type { OpenAPISchema } from '../types/swagger.types.js';
import { authSchemas } from './auth.schemas.js';
import { commonSchemas } from './common.schemas.js';
import { identifySchemas } from './identify.schemas.js';

export const schemas: Record<string, OpenAPISchema> = {
  ...authSchemas,
  ...commonSchemas,
  ...identifySchemas,
};