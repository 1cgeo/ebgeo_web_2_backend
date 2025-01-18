import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { rateLimit } from 'express-rate-limit';
import { db } from '../../common/config/database.js';
import { ApiError } from '../../common/errors/apiError.js';
import logger from '../../common/config/logger.js';
import { UserRole, JWTPayload } from './auth.types.js';
import { envManager } from '../../common/config/environment.js';
import { VALIDATE_API_KEY } from './auth.queries.js';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '15m';

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware principal de autenticação
export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Adiciona ID único para rastreamento da request
  req.id = uuidv4();

  try {
    const apiKey =
      req.query['api_key']?.toString() || req.headers['x-api-key']?.toString();

    const authHeader = req.headers['authorization'];
    const token =
      req.cookies?.token || (authHeader ? authHeader.split(' ')[1] : null);

    // Se não tem token nem apiKey, continua como não autenticado
    if (!token && !apiKey) {
      req.user = undefined;
      return next();
    }

    if (apiKey) {
      const user = await db.oneOrNone(VALIDATE_API_KEY, [apiKey]);

      if (user?.is_active) {
        req.user = {
          userId: user.id,
          username: user.username,
          role: user.role as UserRole,
        };
        return next();
      }
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;

      const cookieConfig = envManager.getCookieConfig();

      // Refresh token se estiver próximo de expirar
      const tokenExp = (decoded as any).exp * 1000;
      if (tokenExp - Date.now() < 5 * 60 * 1000) {
        const newToken = generateToken(decoded);
        res.cookie('token', newToken, {
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
          maxAge: 15 * 60 * 1000,
        });
      }
      return next();
    }

    // Se chegou aqui com token/apiKey inválidos
    req.user = undefined;
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Token expirado'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(ApiError.unauthorized('Token inválido'));
    }
    next(error);
  }
};

// Role-based Authorization
export function authorize<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
>(roles: UserRole[] = []): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    _res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Usuário não autenticado'));
    }

    if (roles.length && !roles.includes(req.user.role)) {
      logger.logSecurity('Unauthorized role access attempt', {
        userId: req.user.userId,
        additionalInfo: {
          requiredRoles: roles,
          userRole: req.user.role,
          path: req.path,
          method: req.method,
        },
      });
      return next(ApiError.forbidden('Acesso negado'));
    }

    next();
  };
}

// Generate JWT Token
export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};
