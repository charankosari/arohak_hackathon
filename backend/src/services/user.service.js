import { bookingModel } from '../models/booking.model.js';
import { cancellationModel } from '../models/cancellation.model.js';
import { hotelModel } from '../models/hotel.model.js';
import { roomModel } from '../models/room.model.js';
import { userModel } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { hashPassword } from '../utils/password.js';
import { serializeUser } from '../utils/serialize.js';

/** Admin-only. Route guards enforce that; these functions assume it. */

export async function listUsers(query) {
  const [users, total] = await userModel.list({
    role: query.role,
    search: query.search,
    skip: query.skip,
    take: query.take,
  });
  return { total, users: users.map(serializeUser) };
}

export async function getUser(id) {
  const user = await userModel.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return serializeUser(user);
}

/** Admins create staff accounts here; the public signup route cannot set a role. */
export async function createUser({ name, email, password, role, phone }) {
  const existing = await userModel.findByEmail(email);
  if (existing) throw ApiError.conflict('An account with this email address already exists');

  const user = await userModel.create({
    name: name.trim(),
    email,
    passwordHash: await hashPassword(password),
    role,
    phone: phone?.trim() || null,
  });
  return serializeUser(user);
}

export async function updateUser({ actor, id, payload }) {
  const target = await userModel.findById(id);
  if (!target) throw ApiError.notFound('User not found');

  // An admin must not be able to lock themselves out of the admin panel.
  if (target.id === actor.id) {
    if (payload.role && payload.role !== target.role) {
      throw ApiError.conflict('You cannot change your own role');
    }
    if (payload.isActive === false) {
      throw ApiError.conflict('You cannot deactivate your own account');
    }
  }

  // Never strand the system without an administrator.
  if (target.role === 'ADMIN' && (payload.role === 'RECEPTIONIST' || payload.role === 'CUSTOMER')) {
    await assertNotLastAdmin(target.id);
  }
  if (target.role === 'ADMIN' && payload.isActive === false) {
    await assertNotLastAdmin(target.id);
  }

  if (payload.email) {
    const clash = await userModel.findByEmail(payload.email);
    if (clash && clash.id !== id) {
      throw ApiError.conflict('An account with this email address already exists');
    }
  }

  const data = {
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.email !== undefined ? { email: payload.email } : {}),
    ...(payload.role !== undefined ? { role: payload.role } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    ...(payload.password ? { passwordHash: await hashPassword(payload.password) } : {}),
  };

  return serializeUser(await userModel.update(id, data));
}

async function assertNotLastAdmin(excludingUserId) {
  const counts = await userModel.countByRole();
  const admins = counts.find((c) => c.role === 'ADMIN')?._count._all ?? 0;
  if (admins <= 1) {
    throw ApiError.conflict(
      'This is the only administrator account; promote another admin first'
    );
  }
  return excludingUserId;
}

/**
 * Accounts are deactivated rather than deleted so their booking history stays
 * intact and auditable.
 */
export async function deactivateUser({ actor, id }) {
  if (actor.id === id) throw ApiError.conflict('You cannot deactivate your own account');

  const target = await userModel.findById(id);
  if (!target) throw ApiError.notFound('User not found');
  if (target.role === 'ADMIN') await assertNotLastAdmin(id);

  return serializeUser(await userModel.update(id, { isActive: false }));
}

/** Headline numbers for the admin dashboard. */
export async function getAdminDashboard() {
  const [roleCounts, hotels, rooms, bookingStatus, revenue, pendingCancellations] =
    await Promise.all([
      userModel.countByRole(),
      hotelModel.list({ take: 1 }),
      roomModel.list({ take: 1 }),
      bookingModel.statusCounts(),
      bookingModel.revenueSum(),
      cancellationModel.countPending(),
    ]);

  return {
    users: Object.fromEntries(roleCounts.map((r) => [r.role, r._count._all])),
    totalHotels: hotels[1],
    totalRooms: rooms[1],
    bookingsByStatus: Object.fromEntries(bookingStatus.map((r) => [r.status, r._count._all])),
    // Excludes cancelled and no-show bookings.
    bookedRevenue: Number(revenue._sum.totalAmount ?? 0),
    pendingCancellationRequests: pendingCancellations,
  };
}
