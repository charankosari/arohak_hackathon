import { getRedis, isRedisReady } from './redis.js';

const PREFIX = 'meridian';

export const cacheKeys = {
  hotelList: (query) => `${PREFIX}:hotels:${query}`,
  hotel: (id) => `${PREFIX}:hotel:${id}`,
  roomList: (query) => `${PREFIX}:rooms:${query}`,
  room: (id) => `${PREFIX}:room:${id}`,
  availability: (query) => `${PREFIX}:availability:${query}`,
  roomTypes: (hotelId) => `${PREFIX}:roomtypes:${hotelId ?? 'all'}`,
};

/** Stable cache key from a filter object - key order must not matter. */
export function fingerprint(obj = {}) {
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join('&') : 'all';
}

async function del(pattern) {
  const redis = getRedis();
  if (!isRedisReady()) return;

  // SCAN rather than KEYS: KEYS blocks the Redis event loop.
  const stream = redis.scanStream({ match: pattern, count: 200 });
  const batch = [];
  for await (const keys of stream) {
    if (keys.length) batch.push(...keys);
  }
  if (batch.length) await redis.del(...batch);
}

export const cache = {
  /** Returns the parsed value, or null on miss / Redis unavailable. */
  async get(key) {
    if (!isRedisReady()) return null;
    try {
      const raw = await getRedis().get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null; // a cache failure must never fail the request
    }
  },

  async set(key, value, ttlSeconds = 60) {
    if (!isRedisReady()) return;
    try {
      await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* ignore */
    }
  },

  /** Read-through helper: serve from cache, else compute and store. */
  async wrap(key, ttlSeconds, producer) {
    const hit = await this.get(key);
    if (hit !== null) return { ...hit, cached: true };

    const value = await producer();
    await this.set(key, value, ttlSeconds);
    return value;
  },

  // --- Invalidation ----------------------------------------------------
  // Availability depends on rooms, hotels and bookings, so any write to those
  // clears it. TTLs are short, so over-invalidating is cheap and always safe.

  invalidateAvailability: () => del(`${PREFIX}:availability:*`),

  async invalidateRooms() {
    await Promise.all([
      del(`${PREFIX}:rooms:*`),
      del(`${PREFIX}:room:*`),
      del(`${PREFIX}:roomtypes:*`),
      del(`${PREFIX}:availability:*`),
    ]);
  },

  async invalidateHotels() {
    await Promise.all([
      del(`${PREFIX}:hotels:*`),
      del(`${PREFIX}:hotel:*`),
      del(`${PREFIX}:availability:*`),
    ]);
  },

  flushAll: () => del(`${PREFIX}:*`),
};

/** Cache lifetimes, in seconds. Short by design: this is hot booking data. */
export const TTL = {
  hotels: 300,
  rooms: 120,
  availability: 30,
  roomTypes: 600,
};
