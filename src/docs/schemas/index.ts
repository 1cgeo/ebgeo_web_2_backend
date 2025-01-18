import type { OpenAPISchema } from '../types/swagger.types.js';
import { authSchemas } from './auth.schemas.js';
import { commonSchemas } from './common.schemas.js';
import { identifySchemas } from './identify.schemas.js';
import { groupSchemas } from './groups.schemas.js';
import { userSchemas } from './users.schemas.js';
import { catalog3dSchemas } from './catalog3d.schemas.js';
import { geographicSchemas } from './geographic.schemas.js';
import { adminSchemas } from './admin.schemas.js';

export const schemas: Record<string, OpenAPISchema> = {
  ...authSchemas,
  ...commonSchemas,
  ...identifySchemas,
  ...groupSchemas,
  ...userSchemas,
  ...catalog3dSchemas,
  ...geographicSchemas,
  ...adminSchemas,
};
