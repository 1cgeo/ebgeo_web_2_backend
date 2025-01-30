import { Request, Response, NextFunction } from 'express';
import {
  ValidationChain,
  validationResult,
  ValidationError,
} from 'express-validator';
import { ApiError } from '../errors/apiError.js';
import logger, { LogCategory } from '../config/logger.js';

export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Execute all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      // Check for errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Log apenas em caso de falha na validação
        logger.logAccess('Request validation failed', {
          category: LogCategory.API,
          endpoint: req.path,
          method: req.method,
          additionalInfo: {
            errors: errors.array().map((e: ValidationError) => ({
              field: e.type === 'field' ? e.path : undefined,
              message: e.msg,
            })),
          },
        });

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
