import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/** Turn Prisma's error codes into meaningful HTTP responses. */
function translatePrismaError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : (target ?? 'field');
        return ApiError.conflict(`A record with this ${fields} already exists`);
      }
      case 'P2003':
        return ApiError.badRequest('Referenced record does not exist');
      case 'P2025':
        return ApiError.notFound('Record not found');
      case 'P2034':
        // Serializable transaction lost a write race - safe to retry.
        return ApiError.conflict(
          'That room was just booked by someone else. Please refresh and try again.'
        );
      default:
        return null;
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Invalid data supplied');
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ApiError(503, 'Database unavailable. Please try again shortly.');
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // Constraint violations raised by Postgres that Prisma did not map to a
    // P-code. 23503/23001 = foreign key / RESTRICT violation.
    if (/2350[13]|violates (foreign key|RESTRICT)/i.test(error.message)) {
      return ApiError.conflict(
        'This record is referenced by other data and cannot be deleted. ' +
          'Deactivate it instead.'
      );
    }
  }
  return null;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, _next) {
  const apiError = error instanceof ApiError ? error : translatePrismaError(error);

  if (!apiError) {
    // Genuinely unexpected: log it in full, tell the client nothing useful.
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
    return res.status(500).json({
      error: {
        message: 'Something went wrong on our end. Please try again.',
        ...(isProduction ? {} : { debug: error.message, stack: error.stack }),
      },
    });
  }

  if (apiError.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  return res.status(apiError.status).json({
    error: {
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
}
