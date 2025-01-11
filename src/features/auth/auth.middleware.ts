// src/features/auth/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import csrf from 'csurf';
import { UserRole, JWTPayload } from './auth.types.js';
import { ApiError } from '../../common/errors/apiError.js';
import { db } from '../../common/config/database.js';
import { GET_USER_BY_API_KEY } from './auth.queries.js';
import logger from '../../common/config/logger.js';

// Estender a interface Request do Express
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      cookies: {
        token?: string;
        [key: string]: any;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '15m'; // Token expira em 15 minutos

// Rate limiting
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF Protection
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

// JWT Authentication
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token =
      req.cookies?.token || (authHeader ? authHeader.split(' ')[1] : null);
    const apiKey =
      req.query['api_key']?.toString() || req.headers['x-api-key']?.toString();

    if (!token && !apiKey) {
      req.user = undefined;
      return next();
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;

      // Renovar token se estiver próximo do vencimento
      const tokenExp = (decoded as any).exp * 1000;
      const now = Date.now();
      if (tokenExp - now < 5 * 60 * 1000) {
        // 5 minutos para expirar
        const newToken = generateToken(decoded);
        res.cookie('token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 15 * 60 * 1000, // 15 minutos
        });
      }
    } else if (apiKey) {
      const user = await db.oneOrNone(GET_USER_BY_API_KEY, [apiKey]);
      if (user) {
        req.user = {
          userId: user.id,
          username: user.username,
          role: user.role as UserRole,
          apiKey: user.api_key,
        };
      }
    }

    // Log da request com informações do usuário
    logger.info('Request authenticated', {
      userId: req.user?.userId || 'visitor',
      username: req.user?.username || 'visitor',
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Token expirado'));
    }
    return next(ApiError.unauthorized('Token inválido'));
  }
};

// Role-based Authorization
export const authorize = (roles: UserRole[] = []) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Usuário não autenticado'));
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Acesso negado'));
    }

    next();
  };
};

// Generate JWT Token
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

// Validate API Key
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const user = await db.oneOrNone(GET_USER_BY_API_KEY, [apiKey]);
  return !!user;
};
