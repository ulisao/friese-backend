// src/server.ts
import Fastify from 'fastify';
import { pool } from './db';

const fastify = Fastify({ logger: true });

const start = async () => {
  try {
    // 1. Verificamos la conexión a la base de datos haciendo un query simple
    const client = await pool.connect();
    fastify.log.info('Conexión a PostgreSQL (Supabase) exitosa');
    client.release(); // Siempre soltamos el cliente para devolverlo al pool

    // 2. Levantamos el servidor de Fastify
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error({ err }, 'Error arrancando el servidor o conectando a la DB');
    process.exit(1);
  }
};

start();