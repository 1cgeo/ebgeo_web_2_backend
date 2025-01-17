import type { OpenAPISchema } from '../types/swagger.types.js';

export const identifySchemas: Record<string, OpenAPISchema> = {
  Feature: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'ID único da feição',
      },
      nome: {
        type: 'string',
        description: 'Nome da feição',
      },
      municipio: {
        type: 'string',
        description: 'Município onde a feição está localizada',
      },
      estado: {
        type: 'string',
        description: 'Estado onde a feição está localizada',
      },
      tipo: {
        type: 'string',
        description: 'Tipo da feição',
      },
      altitude_base: {
        type: 'number',
        description: 'Altitude da base da feição em metros',
      },
      altitude_topo: {
        type: 'number',
        description: 'Altitude do topo da feição em metros',
      },
      model_id: {
        type: 'string',
        format: 'uuid',
        description: 'ID do modelo 3D associado',
      },
      model_name: {
        type: 'string',
        description: 'Nome do modelo 3D associado',
      },
      model_description: {
        type: 'string',
        description: 'Descrição do modelo 3D associado',
      },
      z_distance: {
        type: 'number',
        description: 'Distância vertical até o ponto de busca em metros',
      },
      xy_distance: {
        type: 'number',
        description: 'Distância horizontal até o ponto de busca em metros',
      },
    },
    required: ['id', 'altitude_base', 'altitude_topo', 'model_id'],
  },
};