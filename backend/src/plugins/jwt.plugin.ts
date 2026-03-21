// src/plugins/jwt.plugin.ts
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import crypto from 'node:crypto';

export const jwtPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET as string
  });

  // Para rutas de empresa (admin/dashboard)
  // Valida firma, expiración y role
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
  // 1. Verifica firma y expiración del JWT
  // 2. Verifica role === 'device'
  // 3. Hashea el token recibido y lo compara con tokenHash en DB
  //    — detecta tokens adulterados aunque la firma sea válida
  // 4. Verifica isActive — revocación en tiempo real
  // 5. Escribe request.deviceId para que los handlers lo usen en AuditLog
  fastify.decorate('authenticateDevice', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'No autorizado. Token inválido o expirado.' });
    }

    if (request.user.role !== 'device') {
      return reply.status(403).send({ error: 'Acceso restringido a dispositivos operarios.' });
    }

    // Extraer el token crudo del header para hashear
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'No autorizado. Header Authorization ausente.' });
    }
    const rawToken = authHeader.slice(7); // quitar "Bearer "

    const device = await prisma.device.findUnique({
      where: { id: request.user.id }
    });

    if (!device) {
      return reply.status(401).send({ error: 'Dispositivo no encontrado.' });
    }

    // Verificación de integridad: el token en circulación debe coincidir
    // con el que se generó al crear el QR — detecta tokens robados o reemplazados
    const incomingHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    if (incomingHash !== device.tokenHash) {
      request.log.warn(`[SECURITY] Hash mismatch en request de device ${device.id}`);
      return reply.status(401).send({ error: 'No autorizado. Token de dispositivo inválido.' });
    }

    // Revocación en tiempo real — el JWT puede ser válido pero el device inactivo
    if (!device.isActive) {
      request.log.warn(`[auth] Request rechazado de device revocado: ${device.id}`);
      return reply.status(401).send({ error: 'Este dispositivo fue revocado. Contactá al administrador.' });
    }

    // Exponer device_id en el request para que los handlers lo usen en AuditLog
    // Uso: request.deviceId en cualquier handler protegido con authenticateDevice
    request.deviceId = device.id;
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate:       (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateDevice: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    deviceId?: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      id:        string;
      email?:    string;
      companyId?: string;
      role:      'company' | 'device';
    };
    user: {
      id:        string;
      email?:    string;
      companyId?: string;
      role:      'company' | 'device';
    };
  }
}