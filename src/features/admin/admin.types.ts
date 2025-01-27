// Métricas do Sistema
export interface SystemMetrics {
  system: {
    uptime: number;
    nodeVersion: string;
    environment: string;
    memory: {
      total: number;
      used: number;
      free: number;
    };
    cpu: {
      usage: number;
      loadAvg: number[];
    };
  };
  database: {
    connectionPool: {
      total: number;
      active: number;
      idle: number;
    };
  };
  usage: {
    totalUsers: number;
    activeUsers: number;
    totalGroups: number;
    totalModels: {
      total: number;
      public: number;
      private: number;
    };
  };
  logs: {
    errors24h: number;
    warnings24h: number;
    totalRequests24h: number;
  };
}

// Health Check
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  details?: Record<string, any>;
  lastCheck: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  environment: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    fileSystem: ServiceHealth;
    auth: ServiceHealth;
    api: ServiceHealth;
  };
  memory: {
    used: number;
    total: number;
    percentUsed: number;
  };
}

// Audit Trail
export type AuditAction =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_ROLE_CHANGE'
  | 'GROUP_CREATE'
  | 'GROUP_UPDATE'
  | 'GROUP_DELETE'
  | 'ZONE_CREATE'
  | 'ZONE_DELETE'
  | 'MODEL_PERMISSION_CHANGE'
  | 'ZONE_PERMISSION_CHANGE'
  | 'API_KEY_REGENERATE'
  | 'ADMIN_LOGIN'
  | 'ADMIN_ACTION';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: {
    id: string;
    username: string;
  };
  target?: {
    type: 'USER' | 'GROUP' | 'MODEL' | 'ZONE' | 'SYSTEM';
    id: string;
    name: string;
  };
  details: Record<string, any>;
  ip: string;
  userAgent?: string;
}

export interface AuditQueryParams {
  startDate?: string;
  endDate?: string;
  action?: AuditAction;
  actorId?: string;
  targetId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}
