import { UserRole } from '../auth/auth.types.js';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
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
  password: string;
  role: UserRole;
  groupIds?: string[];
}

export interface UpdateUserDTO {
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdatePasswordDTO {
  currentPassword?: string; // Opcional para admin, obrigatório para self
  newPassword: string;
}

export interface UpdateProfileDTO {
  email?: string;
}

// Query params para listagem
export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  role?: UserRole | 'all';
}

// Response types
export interface UserListResponse {
  users: Array<User & { groupCount: number }>;
  total: number;
  page: number;
  limit: number;
}
