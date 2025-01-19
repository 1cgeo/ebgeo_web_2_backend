import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import { ApiError } from '../errors/apiError.js';

export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Executa todas as validações
    await Promise.all(validations.map(validation => validation.run(req)));

    // Verifica se houve erros
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.unprocessableEntity('Dados inválidos', {
        errors: errors.array(),
      });
    }
    next();
  };
};
