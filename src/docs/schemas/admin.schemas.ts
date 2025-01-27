import type { OpenAPISchema } from '../types/swagger.types.js';

export const adminSchemas: Record<string, OpenAPISchema> = {
  SystemHealth: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['healthy', 'unhealthy', 'degraded'],
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
      },
      environment: {
        type: 'string',
      },
      uptime: {
        type: 'number',
      },
      services: {
        type: 'object',
        properties: {
          database: {
            $ref: '#/components/schemas/ServiceHealth',
          },
          fileSystem: {
            $ref: '#/components/schemas/ServiceHealth',
          },
          auth: {
            $ref: '#/components/schemas/ServiceHealth',
          },
          api: {
            $ref: '#/components/schemas/ServiceHealth',
          },
        },
      },
      memory: {
        type: 'object',
        properties: {
          used: { type: 'number' },
          total: { type: 'number' },
          percentUsed: { type: 'number' },
        },
      },
    },
  },

  ServiceHealth: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['healthy', 'unhealthy', 'degraded'],
      },
      details: {
        type: 'object',
        additionalProperties: true,
      },
      lastCheck: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  SystemMetrics: {
    type: 'object',
    properties: {
      system: {
        type: 'object',
        properties: {
          uptime: { type: 'number' },
          nodeVersion: { type: 'string' },
          environment: { type: 'string' },
          memory: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              used: { type: 'number' },
              free: { type: 'number' },
            },
          },
          cpu: {
            type: 'object',
            properties: {
              usage: { type: 'number' },
              loadAvg: {
                type: 'array',
                items: { type: 'number' },
              },
            },
          },
        },
      },
      database: {
        type: 'object',
        properties: {
          connectionPool: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              active: { type: 'number' },
              idle: { type: 'number' },
            },
          },
        },
      },
      usage: {
        type: 'object',
        properties: {
          totalUsers: { type: 'number' },
          activeUsers: { type: 'number' },
          totalGroups: { type: 'number' },
          totalModels: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              public: { type: 'number' },
              private: { type: 'number' },
            },
          },
        },
      },
      logs: {
        type: 'object',
        properties: {
          errors24h: { type: 'number' },
          warnings24h: { type: 'number' },
          totalRequests24h: { type: 'number' },
        },
      },
    },
  },

  LogEntry: {
    type: 'object',
    properties: {
      timestamp: { 
        type: 'string', 
        format: 'date-time' 
      },
      level: {
        type: 'string',
        enum: ['ERROR', 'WARN', 'INFO', 'DEBUG']
      },
      category: {
        type: 'string',
        enum: [
          'AUTH',
          'API',
          'DB',
          'SECURITY',
          'PERFORMANCE',
          'SYSTEM',
          'ACCESS',
          'ADMIN'
        ]
      },
      message: { type: 'string' },
      details: {
        type: 'object',
        additionalProperties: true
      }
    }
  },

  LogResponse: {
    type: 'object',
    properties: {
      logs: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/LogEntry'
        }
      },
      total: { type: 'integer' },
      limit: { type: 'integer' },
      categories: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  },

  AuditEntry: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      timestamp: { type: 'string', format: 'date-time' },
      action: {
        type: 'string',
        enum: [
          'USER_CREATE',
          'USER_UPDATE',
          'USER_DELETE',
          'USER_ROLE_CHANGE',
          'GROUP_CREATE',
          'GROUP_UPDATE',
          'GROUP_DELETE',
          'MODEL_PERMISSION_CHANGE',
          'ZONE_PERMISSION_CHANGE',
          'API_KEY_REGENERATE',
          'ADMIN_LOGIN',
          'ADMIN_ACTION',
        ],
      },
      actor: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string' },
        },
      },
      target: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['USER', 'GROUP', 'MODEL', 'ZONE', 'SYSTEM'],
          },
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
      details: {
        type: 'object',
        additionalProperties: true,
      },
      ip: { type: 'string' },
      userAgent: { type: 'string' },
    },
  },

  AuditResponse: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/AuditEntry',
        },
      },
      total: { type: 'number' },
      page: { type: 'number' },
      limit: { type: 'number' },
    },
  },
};
