// src/routes/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

export async function authRoutes(fastify: FastifyInstance) {

  // POST /auth/register
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as any;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Name, email and password are required' });
    }

    try {
      const existing = await prisma.company.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const company = await prisma.company.create({
        data: { email, passwordHash, name }
      });

      // Devolvemos JWT directo para que el admin entre al dashboard sin login por separado
      const token = fastify.jwt.sign(
        { id: company.id, email: company.email, role: 'company' as const },
        { expiresIn: '24h' }
      );

      return reply.status(201).send({
        token,
        company: {
          id:        company.id,
          email:     company.email,
          name:      company.name,
          createdAt: company.createdAt
        }
      });
    } catch (err) {
      request.log.error({ err }, 'Error registering company');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required' });
    }

    try {
      const company = await prisma.company.findUnique({ where: { email } });
      if (!company) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, company.passwordHash);
      if (!isMatch) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign(
        { id: company.id, email: company.email, role: 'company' as const },
        { expiresIn: '24h' }
      );

      return reply.status(200).send({
        message: 'Login successful',
        token,
        company: { id: company.id, email: company.email, name: company.name }
      });
    } catch (err) {
      request.log.error({ err }, 'Error logging in company');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // GET /auth/activate?token=xxx — Activación del dispositivo vía QR
  fastify.get('/auth/activate', {
    schema: {
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { token } = request.query as { token: string };

    let payload: { id: string; companyId: string; role: string };
    try {
      payload = fastify.jwt.verify(token);
    } catch {
      return reply.status(401).send({ error: 'Token de activación inválido o expirado.' });
    }

    if (payload.role !== 'device') {
      return reply.status(403).send({ error: 'El token no corresponde a un dispositivo.' });
    }

    const device = await prisma.device.findUnique({
      where: { id: payload.id },
      include: { company: true }
    });

    if (!device) {
      return reply.status(404).send({ error: 'Dispositivo no encontrado.' });
    }

    if (!device.isActive) {
      request.log.warn(`[auth] Intento de activación de device revocado: ${device.id}`);
      return reply.status(401).send({ error: 'Este dispositivo fue revocado. Contactá al administrador.' });
    }

    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
    if (incomingHash !== device.tokenHash) {
      request.log.warn(`[SECURITY] Hash mismatch en activación de device ${device.id}`);
      return reply.status(401).send({ error: 'Token de activación inválido.' });
    }

    request.log.info(`[auth] Device activado: ${device.id} (${device.operatorName}) — company: ${device.company.name}`);

    return reply.status(200).send({
      message: 'Dispositivo activado exitosamente.',
      token,
      device: {
        id:           device.id,
        operatorName: device.operatorName,
      },
      company: {
        id:   device.company.id,
        name: device.company.name,
      }
    });
  });
}