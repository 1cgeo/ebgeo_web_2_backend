import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import pkg from '../../package.json' assert { type: 'json' };
import { schemas } from './schemas/index.js';

const version = pkg.version;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EBGeo API Documentation',
      version,
      description: 'Documentação da API do sistema EBGEO',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'Exército Brasileiro - Diretoria de Serviço Geográfico',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Servidor de Desenvolvimento',
      },
    ],
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  },
  apis: ['./src/features/**/routes.ts', './src/docs/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

// Configurações da UI do Swagger
const swaggerUiOptions = {
  customSiteTitle: 'EBGeo API Documentation',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true, // Mantém tokens após recarregar
    displayRequestDuration: true, // Mostra duração das requisições
    filter: true, // Campo de busca de endpoints
    showExtensions: true, // Mostra extensões x-*
    showCommonExtensions: true, // Mostra extensões comuns
    tryItOutEnabled: true, // Habilita "Try it out" por padrão
  },
};

export { swaggerSpec, swaggerUi, swaggerUiOptions };
