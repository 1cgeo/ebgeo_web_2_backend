import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { ApiError } from '../errors/apiError.js';

export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Execute all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      // Check for errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Format the error response consistently
        throw ApiError.unprocessableEntity('Dados inválidos', {
          errors: errors.array(),
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
