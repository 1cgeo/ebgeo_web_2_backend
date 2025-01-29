import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/apiError.js';

interface GeoCoordinates {
  lat?: number;
  lon?: number;
}

const GEO_CONSTRAINTS = {
  lat: { min: -90, max: 90 },
  lon: { min: -180, max: 180 },
  precision: 8, // Maximum decimal places
};

export const sanitizeGeoCoordinates = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const coordinates: GeoCoordinates = {};

    const sanitizeCoordinate = (
      value: string | undefined,
      type: 'lat' | 'lon',
    ): number | undefined => {
      if (!value) return undefined;

      // Remove any whitespace and validate basic format
      const cleaned = value.trim();
      if (!/^-?\d*\.?\d+$/.test(cleaned)) {
        throw new ApiError(400, `Invalid ${type} coordinate format`);
      }

      // Parse and validate the number
      const num = parseFloat(cleaned);

      // Check if within valid range
      if (num < GEO_CONSTRAINTS[type].min || num > GEO_CONSTRAINTS[type].max) {
        throw new ApiError(
          400,
          `${type} must be between ${GEO_CONSTRAINTS[type].min} and ${GEO_CONSTRAINTS[type].max}`,
        );
      }

      // Round to maximum precision to prevent floating point issues
      return Number(num.toFixed(GEO_CONSTRAINTS.precision));
    };

    // Process latitude
    if (req.query.lat !== undefined) {
      coordinates.lat = sanitizeCoordinate(req.query.lat as string, 'lat');
      req.query.lat = coordinates.lat?.toString();
    }

    if (req.query.lon !== undefined) {
      coordinates.lon = sanitizeCoordinate(req.query.lon as string, 'lon');
      req.query.lon = coordinates.lon?.toString();
    }

    // Validate coordinate pair if both are present
    if (coordinates.lat !== undefined && coordinates.lon === undefined) {
      throw new ApiError(
        400,
        'Longitude is required when latitude is provided',
      );
    }
    if (coordinates.lat === undefined && coordinates.lon !== undefined) {
      throw new ApiError(
        400,
        'Latitude is required when longitude is provided',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
