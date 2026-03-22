// src/routes/superadmin/superadmin.routes.ts
import type { FastifyInstance } from 'fastify';
import { getCompanyUsage, getAllCompaniesUsage } from '../../services/usage.js';

export async function superadminRoutes(fastify: FastifyInstance) {

  // Middleware de autenticación — se aplica a todas las rutas de este plugin
  fastify.addHook('onRequest', async (request, reply) => {
    const secret = request.headers['x-superadmin-secret'];

    if (!secret || secret !== process.env.SUPERADMIN_SECRET) {
      request.log.warn(`[SECURITY] Intento de acceso a superadmin sin secret válido desde ${request.ip}`);
      return reply.status(401).send({ error: 'No autorizado.' });
    }
  });

  // GET /superadmin/usage?period=2026-03
  // Consumo de todas las empresas en un período
  fastify.get('/superadmin/usage', {
    schema: {
      querystring: {
        type: 'object',
        required: ['period'],
        properties: {
          period: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}$' // formato YYYY-MM
          }
        }
      }
    }
  }, async (request, reply) => {
    const { period } = request.query as { period: string };

    try {
      const summary = await getAllCompaniesUsage(period);
      return reply.status(200).send({ period, companies: summary });
    } catch (err) {
      request.log.error({ err }, '[superadmin] Error obteniendo usage global');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /superadmin/usage/:companyId?period=2026-03
  // Consumo de una empresa específica en un período
  fastify.get('/superadmin/usage/:companyId', {
    schema: {
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string', format: 'uuid' }
        }
      },
      querystring: {
        type: 'object',
        required: ['period'],
        properties: {
          period: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}$'
          }
        }
      }
    }
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const { period } = request.query as { period: string };

    try {
      const summary = await getCompanyUsage(companyId, period);
      return reply.status(200).send(summary);
    } catch (err: any) {
      if (err.message === 'Empresa no encontrada') {
        return reply.status(404).send({ error: err.message });
      }
      request.log.error({ err }, `[superadmin] Error obteniendo usage de company ${companyId}`);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}