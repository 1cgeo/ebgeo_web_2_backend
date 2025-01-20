export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
  };
  token: string;
}

export interface ApiKeyResponse {
  apiKey: string;
  generatedAt: Date;
}

export interface ApiKeyHistoryEntry {
  apiKey: string;
  createdAt: Date;
  revokedAt: string | null;
  isActive: boolean;
}

export interface ApiKeyHistoryResponse {
  userId: string;
  history: ApiKeyHistoryEntry[];
}

// Estende a interface Request do Express
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      id: string; // Request ID para rastreamento
    }
  }
}
