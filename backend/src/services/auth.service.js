import { userModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { serializeUser } from '../utils/serialize.js';

/**
 * Public self-service registration always produces a CUSTOMER.
 * Staff accounts (ADMIN / RECEPTIONIST) are created by an admin through
 * /api/users, never by anyone choosing their own role at signup.
 */
export async function register({ name, email, password, phone }) {
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw ApiError.conflict('An account with this email address already exists');
  }

  const user = await userModel.create({
    name: name.trim(),
    email,
    passwordHash: await hashPassword(password),
    role: 'CUSTOMER',
    phone: phone?.trim() || null,
  });

  return { user: serializeUser(user), token: signAccessToken(user) };
}

export async function login({ email, password }) {
  const user = await userModel.findByEmailWithSecret(email);

  // Same error and roughly the same work for "no such user" and "wrong
  // password", so the response cannot be used to enumerate accounts.
  if (!user) {
    await verifyPassword(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Please contact the hotel.');
  }

  return { user: serializeUser(user), token: signAccessToken(user) };
}

export async function getProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return serializeUser(user);
}

export async function updateProfile(userId, { name, phone }) {
  const user = await userModel.update(userId, {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
  });
  return serializeUser(user);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await userModel.findByEmailWithSecret(
    (await userModel.findById(userId))?.email ?? ''
  );
  if (!user) throw ApiError.notFound('User not found');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  await userModel.update(userId, { passwordHash: await hashPassword(newPassword) });
  return { message: 'Password updated' };
}
