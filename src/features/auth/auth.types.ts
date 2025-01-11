export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum ModelAccessLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export interface User {
  id: string;
  username: string;
  password: string; // Hashed
  email: string;
  role: UserRole;
  apiKey: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
}

export interface UserGroup {
  userId: string;
  groupId: string;
  addedBy: string; // User ID
  addedAt: Date;
}

export interface ModelShare {
  modelId: string;
  accessLevel: ModelAccessLevel;
  sharedWith?: {
    userIds?: string[];
    groupIds?: string[];
  };
  createdBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
  apiKey: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface ApiKeyResponse {
  apiKey: string;
  generatedAt: Date;
  previousKeys?: Array<{
    apiKey: string;
    createdAt: Date;
    revokedAt?: Date;
  }>;
}

export interface ModelPermissionUpdate {
  modelId: string;
  accessLevel: ModelAccessLevel;
  sharedWith: {
    userIds?: string[];
    groupIds?: string[];
  };
}

// Para o middleware de autenticação
export interface RequestWithUser extends Request {
  user?: JWTPayload;
}

export interface LoginRequestBody {
  username: string;
  password: string;
}

export interface CreateUserRequestBody {
  username: string;
  password: string;
  email: string;
  role: UserRole;
}

export interface ApiKeyRequestBody {
  username: string;
}
