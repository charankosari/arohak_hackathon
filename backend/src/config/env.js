import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy backend/.env.example to backend/.env and fill it in.'
    );
  }
  return value.trim();
}

function optional(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '4000')),

  databaseUrl: required('DATABASE_URL'),

  // Optional: when unset the API runs without caching and rate-limits in-memory.
  redisUrl: optional('REDIS_URL', ''),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),

  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
  
export const isProduction = env.nodeEnv === 'production';

/**
 * Hotel operating rules, mirroring AROHAK_Hotel_Information_For_RAG.pdf.
 * India observes no daylight saving, so a fixed +05:30 offset is exact.
 */
export const hotelRules = {
  timezoneOffsetMinutes: 330, // IST (UTC+05:30)
  checkInHour: 14, //  2:00 PM  (PDF section 2)
  checkOutHour: 12, // 12:00 PM (PDF section 2)
  /** A guest may cancel directly until this many hours before check-in. */
  directCancellationWindowHours: 24, // PDF section 3
  maxStayNights: 30,
};
