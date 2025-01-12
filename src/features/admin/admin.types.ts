import { LogCategory } from '../../common/config/logger.js';
import { UserRole } from '../auth/auth.types.js';

// Parâmetros para consulta de logs
export interface LogQueryParams {
  startDate?: string;
  endDate?: string;
  level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  category?: LogCategory;
  search?: string;
  page?: number;
  limit?: number;
}

// Resposta de métricas do sistema
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

// Tipos para gerenciamento de usuários
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  role?: UserRole | 'all';
}

export interface UserUpdateData {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

// Tipos para respostas da API
export interface UserListResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface GroupMembersResponse {
  members: Array<{
    id: string;
    username: string;
    email: string;
    addedAt: Date;
    addedBy: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

// Parâmetros para grupos
export interface GroupMembersParams {
  page?: number;
  limit?: number;
}

// Parâmetros para logs
export interface LogResponse {
  logs: Array<{
    timestamp: string;
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
    category: LogCategory;
    message: string;
    details?: Record<string, unknown>;
  }>;
  total: number;
  page: number;
  limit: number;
}
