import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction } from './config/env.js';
import { isRedisReady } from './lib/redis.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { globalLimiter } from './middlewares/rateLimit.middleware.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // Behind Railway/Render/nginx, the client IP arrives in X-Forwarded-For.
  // Rate limiting is per-IP, so this must be right or every caller shares one
  // bucket. `1` trusts exactly one proxy hop rather than anything upstream.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, server-to-server, health checks.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(morgan(isProduction ? 'combined' : 'dev'));

  app.use(globalLimiter);

  // --- Health ---------------------------------------------------------
  app.get('/health', async (_req, res) => {
    let database = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      /* reported as down */
    }

    const healthy = database === 'up';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      // Redis is an accelerator: "disabled" is a healthy state, not a failure.
      services: { database, cache: isRedisReady() ? 'up' : 'disabled' },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'Meridian Grand Hotel Management API',
      version: '1.0.0',
      docs: '/api',
    });
  });

  app.get('/api', (_req, res) => {
    res.json({
      auth: '/api/auth',
      users: '/api/users',
      hotels: '/api/hotels',
      rooms: '/api/rooms',
      bookings: '/api/bookings',
      cancellationRequests: '/api/cancellation-requests',
    });
  });

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
