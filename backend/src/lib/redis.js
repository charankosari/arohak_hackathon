import Redis from 'ioredis';
import { env } from '../config/env.js';

/**
 * Redis is treated as an accelerator, never a dependency.
 *
 * If REDIS_URL is unset, or Redis is unreachable, the app keeps serving:
 * caching becomes a no-op and rate limiting falls back to an in-process store.
 * That keeps a Redis outage from turning into an API outage.
 */

let client = null;
let ready = false;

function build() {
  if (!env.redisUrl) return null;

  const redis = new Redis(env.redisUrl, {
    // Fail fast instead of queueing commands while Redis is down.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: (times) => {
      if (times > 10) return null; // stop retrying; stay in degraded mode
      return Math.min(times * 200, 3000);
    },
  });

  redis.on('ready', () => {
    ready = true;
    console.log('[redis] connected');
  });
  redis.on('end', () => {
    ready = false;
  });
  // Without a listener, ioredis errors become unhandled 'error' events and
  // crash the process. Log once per transition instead.
  redis.on('error', (error) => {
    if (ready) console.warn(`[redis] connection lost: ${error.message}`);
    ready = false;
  });

  return redis;
}

export async function initRedis() {
  if (!env.redisUrl) {
    console.log('[redis] REDIS_URL not set - caching disabled, rate limiting in-memory');
    return null;
  }
  client = build();
  try {
    await client.connect();
    await client.ping();
  } catch (error) {
    console.warn(
      `[redis] unavailable at startup (${error.message}) - running without cache`
    );
  }
  return client;
}

/** The raw client, or null when Redis is not configured/available. */
export const getRedis = () => client;

/** True only when commands can actually be served right now. */
export const isRedisReady = () => Boolean(client) && ready;

export async function closeRedis() {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
    client = null;
    ready = false;
  }
}
