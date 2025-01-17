import type { OpenAPIV3 } from 'openapi-types';

export interface SwaggerUiOptions {
  customSiteTitle?: string;
  customCss?: string;
  swaggerOptions?: {
    persistAuthorization?: boolean;
    displayRequestDuration?: boolean;
    docExpansion?: 'none' | 'list' | 'full';
    filter?: boolean;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    tryItOutEnabled?: boolean;
  };
}

export type OpenAPISchema = OpenAPIV3.SchemaObject;
export type OpenAPIComponents = OpenAPIV3.ComponentsObject;
