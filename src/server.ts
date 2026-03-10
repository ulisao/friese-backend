// src/server.ts
import Fastify from 'fastify';
import { prisma } from './db';
import { shipmentRoutes } from './routes/shipments.routes';
import { evidenceRoutes } from './routes/evidence.routes';
import { fleteRoutes } from './routes/flete.routes';
import multipart from '@fastify/multipart';

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
    // 1. Verificamos la conexión a la base de datos haciendo un query simple
    await prisma.$connect();
    fastify.log.info('Conexión a PostgreSQL (Supabase) exitosa');

    // 2. Levantamos el servidor de Fastify
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error({ err }, 'Error arrancando el servidor o conectando a la DB');
    process.exit(1);
  }
};

start();
fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024,
  }
});
fastify.register(shipmentRoutes);
fastify.register(evidenceRoutes);
fastify.register(fleteRoutes);

