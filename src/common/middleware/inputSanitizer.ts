import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../config/sanitization.js';

export const sanitizeInputs = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Sanitização específica para coordenadas geográficas
export const sanitizeGeoCoordinates = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const sanitizeCoordinate = (
    value: string | undefined,
  ): number | undefined => {
    if (!value) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  };

  if (req.query.lat) {
    req.query.lat = sanitizeCoordinate(req.query.lat as string)?.toString();
  }
  if (req.query.lon) {
    req.query.lon = sanitizeCoordinate(req.query.lon as string)?.toString();
  }

  next();
};
