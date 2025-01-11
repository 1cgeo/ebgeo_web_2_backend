export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
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

export interface ApiKeyHistoryEntry {
  apiKey: string;
  createdAt: Date;
  revokedAt?: Date;
  isActive: boolean;
}
export interface ApiKeyHistoryResponse {
  userId: string;
  history: ApiKeyHistoryEntry[];
}
