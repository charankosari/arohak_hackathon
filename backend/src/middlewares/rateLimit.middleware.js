import rateLimit, { ipKeyGenerator, MemoryStore } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis, isRedisReady } from '../lib/redis.js';

/**
 * Rate limiting, shared across API instances via Redis when it is available and
 * falling back to an in-process store otherwise.
 *
 * The indirection matters: this module is imported through the route tree, so
 * its body runs before `initRedis()` has been awaited. Choosing a store once at
 * construction would therefore always pick the in-memory one and never upgrade.
 * HybridStore resolves the backing store on every call instead, so limiters
 * built at import time still start using Redis the moment it connects - and
 * silently fall back if it later drops.
 */
class HybridStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.memory = new MemoryStore();
    this.redis = null;
    this.options = null;
  }

  init(options) {
    this.options = options;
    this.memory.init(options);
  }

  /** Redis when it is up, memory otherwise. Counts do not carry across. */
  active() {
    if (!isRedisReady()) return this.memory;

    if (!this.redis) {
      this.redis = new RedisStore({
        prefix: `meridian:rl:${this.prefix}:`,
        sendCommand: (...args) => getRedis().call(...args),
      });
      if (this.options) this.redis.init(this.options);
    }
    return this.redis;
  }

  async increment(key) {
    try {
      return await this.active().increment(key);
    } catch {
      // A Redis hiccup must not 500 the request - degrade to local counting.
      return this.memory.increment(key);
    }
  }

  async decrement(key) {
    try {
      return await this.active().decrement(key);
    } catch {
      return this.memory.decrement(key);
    }
  }

  async resetKey(key) {
    try {
      return await this.active().resetKey(key);
    } catch {
      return this.memory.resetKey(key);
    }
  }

  async resetAll() {
    await this.memory.resetAll?.();
    await this.redis?.resetAll?.();
  }
}

function makeLimiter({ prefix, windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // RateLimit / RateLimit-Policy response headers
    legacyHeaders: false,
    store: new HybridStore(prefix),
    keyGenerator,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message,
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        },
      });
    },
  });
}

/** Baseline ceiling for all API traffic. */
export const globalLimiter = makeLimiter({
  prefix: 'global',
  windowMs: 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/**
 * Login and registration are brute-force targets, so they are limited per
 * IP *and* per submitted email - one attacker cannot lock out a whole office
 * NAT, and rotating IPs cannot hammer a single account.
 */
export const authLimiter = makeLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts. Please try again in a few minutes.',
  keyGenerator: (req) => {
    // ipKeyGenerator normalises IPv6 addresses to a /56 block.
    const ip = ipKeyGenerator(req.ip);
    const email = String(req.body?.email ?? '').toLowerCase().trim();
    return email ? `${ip}|${email}` : ip;
  },
});

/** Writes that create real-world commitments get a tighter ceiling. */
export const bookingWriteLimiter = makeLimiter({
  prefix: 'booking-write',
  windowMs: 60 * 1000,
  limit: 20,
  message: 'Too many booking operations. Please wait a moment before retrying.',
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
});

/** Availability search is cheap but cacheable and easily abused by scrapers. */
export const searchLimiter = makeLimiter({
  prefix: 'search',
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Too many search requests. Please wait a moment before retrying.',
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
});
