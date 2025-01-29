import { UserRole } from '../auth/auth.types.js';

export enum PostoGraduacao {
  CIV = 'Civ',
  PCTD = 'PCTD',
  SD_EV = 'Sd EV',
  SD_EP = 'Sd EP',
  CB = 'Cb',
  TER_SGT = '3º Sgt',
  SEG_SGT = '2º Sgt',
  PRI_SGT = '1º Sgt',
  ST = 'ST',
  ASP = 'Asp',
  SEG_TEN = '2º Ten',
  PRI_TEN = '1º Ten',
  CAP = 'Cap',
  MAJ = 'Maj',
  TC = 'TC',
  CEL = 'Cel',
  GEN_BDA = 'Gen Bda',
  GEN_DIV = 'Gen Div',
  GEN_EX = 'Gen Ex',
}

export interface User {
  id: string;
  username: string;
  email: string;
  nome_completo?: string;
  nome_guerra?: string;
  organizacao_militar?: string;
  posto_graduacao?: PostoGraduacao;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDetails extends User {
  groupCount: number;
  groups: UserGroup[];
  apiKeys: ApiKeyInfo[];
  permissions: UserPermissions;
}

export interface UserGroup {
  id: string;
  name: string;
  addedAt: Date;
  addedBy: string;
}

export interface ApiKeyInfo {
  key: string;
  createdAt: Date;
  revokedAt?: Date;
  isActive: boolean;
}

export interface UserPermissions {
  models: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      accessType: 'direct' | 'group';
      groupId?: string;
    }>;
  };
  zones: {
    count: number;
    items: Array<{
      id: string;
      name: string;
      accessType: 'direct' | 'group';
      groupId?: string;
    }>;
  };
}

// DTOs para requests
export interface CreateUserDTO {
  username: string;
  email: string;
  nome_completo?: string;
  nome_guerra?: string;
  organizacao_militar?: string;
  posto_graduacao?: PostoGraduacao;
  password: string;
  role: UserRole;
  groupIds?: string[];
}
export interface UpdateUserDTO {
  email?: string;
  nome_completo?: string;
  nome_guerra?: string;
  organizacao_militar?: string;
  posto_graduacao?: PostoGraduacao;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdatePasswordDTO {
  currentPassword?: string; // Opcional para admin, obrigatório para self
  newPassword: string;
}

export interface UpdateProfileDTO {
  email?: string;
  nome_completo?: string;
  nome_guerra?: string;
  organizacao_militar?: string;
  posto_graduacao?: PostoGraduacao;
}

// Query params para listagem
export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  role?: UserRole | 'all';
  sort?:
    | 'username'
    | 'email'
    | 'role'
    | 'created_at'
    | 'last_login'
    | 'group_count';
  order?: 'asc' | 'desc';
}

// Response types
export interface UserListResponse {
  users: Array<User & { groupCount: number }>;
  total: number;
  page: number;
  limit: number;
}
