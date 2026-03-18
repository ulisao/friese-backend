// src/plugins/jwt.plugin.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';

export const jwtPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET as string
  });

  // Para rutas de empresa (admin/dashboard)
  // Valida solo la firma y expiración del JWT
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();

      if (request.user.role !== 'company') {
        return reply.status(403).send({ error: 'Acceso restringido a cuentas de empresa.' });
      }
    } catch {
      reply.status(401).send({ error: 'No autorizado. Token inválido o expirado.' });
    }
  });

  // Para rutas de operario (device)
  // Valida la firma del JWT + verifica en DB que el device no fue revocado
  fastify.decorate('authenticateDevice', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();

      if (request.user.role !== 'device') {
        return reply.status(403).send({ error: 'Acceso restringido a dispositivos operarios.' });
      }

      // Chequeo de revocación — el JWT puede ser válido pero el device inactivo
      const device = await prisma.device.findUnique({
        where: { id: request.user.id }
      });

      if (!device) {
        return reply.status(401).send({ error: 'Dispositivo no encontrado.' });
      }

      if (!device.isActive) {
        request.log.warn(`[auth] Request rechazado de device revocado: ${device.id}`);
        return reply.status(401).send({ error: 'Este dispositivo fue revocado. Contactá al administrador.' });
      }
    } catch {
      reply.status(401).send({ error: 'No autorizado. Token inválido o expirado.' });
    }
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateDevice: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id: string;
      email?: string;
      companyId?: string;
      role: 'company' | 'device';
    };
    user: {
      id: string;
      email?: string;
      companyId?: string;
      role: 'company' | 'device';
    };
  }
}