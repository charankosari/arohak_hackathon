import { ApiError } from '../utils/ApiError.js';

/**
 * Validate one part of the request against a Zod schema and replace it with
 * the parsed result, so controllers receive coerced, trimmed, typed values.
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }

    // Express 5 exposes req.query via a getter, so assign onto the request
    // under a separate key rather than overwriting it.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;

    next();
  };
}

export const validateBody = (schema) => validate(schema, 'body');
export const validateQuery = (schema) => validate(schema, 'query');
export const validateParams = (schema) => validate(schema, 'params');
