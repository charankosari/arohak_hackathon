import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Mint an access token. The role travels in the token; guards re-check the DB. */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
