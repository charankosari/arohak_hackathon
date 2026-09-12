import { userModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';

function readBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Resolve the caller from their bearer token.
 *
 * The role is re-read from the database rather than trusted from the token, so
 * a demotion or deactivation takes effect immediately instead of when the
 * token happens to expire.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid token'
    );
  }

  const user = await userModel.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  req.user = user;
  next();
});

/** Attaches req.user when a valid token is present, but never rejects. */
export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await userModel.findById(payload.sub);
    if (user?.isActive) req.user = user;
  } catch {
    // Anonymous is a valid state on these routes.
  }
  next();
});

/**
 * Role gate. Use after `authenticate`.
 *   requireRoles('ADMIN')                  - admin only
 *   requireRoles('ADMIN', 'RECEPTIONIST')  - any staff member
 */
export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `This action requires the ${roles.join(' or ')} role; you are signed in as ${req.user.role}`
        )
      );
    }
    next();
  };
}

export const requireAdmin = requireRoles('ADMIN');
export const requireStaff = requireRoles('ADMIN', 'RECEPTIONIST');
