import { ErrorDetails } from './errorTypes.js';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: ErrorDetails;

  constructor(
    statusCode: number,
    message: string,
    details?: ErrorDetails,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(msg: string, details?: ErrorDetails) {
    return new ApiError(400, msg, details);
  }

  static unauthorized(msg: string = 'Não autorizado', details?: ErrorDetails) {
    return new ApiError(401, msg, details);
  }

  static forbidden(msg: string = 'Acesso negado', details?: ErrorDetails) {
    return new ApiError(403, msg, details);
  }

  static notFound(
    msg: string = 'Recurso não encontrado',
    details?: ErrorDetails,
  ) {
    return new ApiError(404, msg, details);
  }

  static conflict(msg: string = 'Conflito detectado', details?: ErrorDetails) {
    return new ApiError(409, msg, details);
  }

  static unprocessableEntity(
    msg: string = 'Dados inválidos',
    details?: ErrorDetails,
  ) {
    return new ApiError(422, msg, details);
  }

  static internal(msg: string = 'Erro interno do servidor') {
    return new ApiError(500, msg, undefined, false);
  }

  static serviceUnavailable(msg: string = 'Serviço indisponível') {
    return new ApiError(503, msg, undefined, false);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}
