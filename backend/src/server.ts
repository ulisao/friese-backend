// src/server.ts
import Fastify from 'fastify';
import { prisma } from './db.js';
import { jwtPlugin } from './plugins/jwt.plugin.js';
import { authRoutes } from './routes/auth.routes.js';
import { shipmentRoutes } from './routes/shipments.routes.js';
import { evidenceRoutes } from './routes/evidence.routes.js';
import { fleteRoutes } from './routes/flete.routes.js';
import { trackingRoutes } from './routes/tracking.routes.js';
import { devicesRoutes } from './routes/admin/devices.routes.js';
import multipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true
      }
    }
  }
});

const start = async () => {
  try {
    await prisma.$connect();
    fastify.log.info('Conexión a PostgreSQL (Supabase) exitosa');

    // Plugins — deben registrarse antes que las rutas
    await fastify.register(jwtPlugin);

    fastify.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024
      }
    });

    fastify.register(fastifyRateLimit, {
      global: false,
      max: 5,
      timeWindow: '10 minute'
    });

    // Rutas
    fastify.register(authRoutes);
    fastify.register(shipmentRoutes);
    fastify.register(evidenceRoutes);
    fastify.register(fleteRoutes);
    fastify.register(trackingRoutes);
    fastify.register(devicesRoutes);

    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error({ err }, 'Error arrancando el servidor o conectando a la DB');
    process.exit(1);
  }
};

start();