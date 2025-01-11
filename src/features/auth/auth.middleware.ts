import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
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
      userType: 'authenticated' | 'guest';
      requestId: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '15m';

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // default 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // default 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF Protection
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite:
      (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',
  },
});

// Main authentication middleware
export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Generate unique request ID for tracking
  req.requestId = uuidv4();

  try {
    // Check for API key in multiple locations
    const apiKey =
      req.query['api_key']?.toString() || req.headers['x-api-key']?.toString();

    // Check for JWT token
    const authHeader = req.headers['authorization'];
    const token =
      req.cookies?.token || (authHeader ? authHeader.split(' ')[1] : null);

    if (!token && !apiKey) {
      // Mark as guest user
      req.userType = 'guest';
      req.user = undefined;

      // Log guest request
      logger.info('Guest request received', {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return next();
    }

    // Handle API key authentication
    if (apiKey) {
      const user = await db.oneOrNone(
        'SELECT id, username, role, is_active FROM ng.users WHERE api_key = $1 AND is_active = true',
        [apiKey],
      );

      if (user) {
        req.user = {
          userId: user.id,
          username: user.username,
          role: user.role as UserRole,
          apiKey: apiKey,
        };
        req.userType = 'authenticated';

        // Log authenticated request via API key
        logger.info('API key authenticated request', {
          requestId: req.requestId,
          userId: user.id,
          username: user.username,
          path: req.path,
          method: req.method,
        });

        return next();
      }
    }

    // Handle JWT authentication
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = decoded;
      req.userType = 'authenticated';

      // Check if token needs renewal (5 minutes to expiry)
      const tokenExp = (decoded as any).exp * 1000;
      if (tokenExp - Date.now() < 5 * 60 * 1000) {
        const newToken = generateToken(decoded);
        res.cookie('token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite:
            (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') ||
            'strict',
          maxAge: 15 * 60 * 1000,
        });
      }

      // Log authenticated request via JWT
      logger.info('JWT authenticated request', {
        requestId: req.requestId,
        userId: decoded.userId,
        username: decoded.username,
        path: req.path,
        method: req.method,
      });

      return next();
    }

    // If no valid authentication found, mark as guest
    req.userType = 'guest';
    req.user = undefined;

    logger.info('Invalid authentication attempt', {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    next();
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
  P = ParamsDictionary,
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
      logger.warn('Unauthorized role access attempt', {
        requestId: req.requestId,
        userId: req.user.userId,
        requiredRoles: roles,
        userRole: req.user.role,
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

// Validate API Key
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const user = await db.oneOrNone(GET_USER_BY_API_KEY, [apiKey]);
  return !!user;
};
