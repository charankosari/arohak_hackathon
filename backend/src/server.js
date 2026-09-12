import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectPrisma, prisma } from './lib/prisma.js';
import { closeRedis, initRedis } from './lib/redis.js';

async function start() {
  // Fail loudly at boot if the database is unreachable, rather than serving
  // 500s on every request.
  try {
    await prisma.$connect();
    console.log('[db] connected');
  } catch (error) {
    console.error('[db] connection failed:', error.message);
    process.exit(1);
  }

  // Redis is optional; initRedis logs and continues if it is unavailable.
  await initRedis();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`[api] CORS origins: ${env.corsOrigins.join(', ')}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    // Stop accepting connections, then drain.
    server.close(async () => {
      await Promise.allSettled([disconnectPrisma(), closeRedis()]);
      console.log('[api] shutdown complete');
      process.exit(0);
    });

    // Don't hang forever on a stuck connection.
    setTimeout(() => {
      console.error('[api] forced exit after 10s');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('[api] unhandled rejection:', reason);
  });
}

start();
