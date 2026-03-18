// src/routes/admin/devices.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import crypto from 'node:crypto';

export async function devicesRoutes(fastify: FastifyInstance) {

  // POST /admin/devices — Generar QR para operario
  fastify.post('/admin/devices', {
    preHandler: fastify.authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['operatorName'],
        properties: {
          operatorName: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const { id: companyId } = request.user;
    const { operatorName } = request.body as { operatorName: string };

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return reply.status(404).send({ error: 'Empresa no encontrada.' });
    }

    const deviceId = crypto.randomUUID();

    const deviceToken = fastify.jwt.sign(
      { id: deviceId, companyId, role: 'device' as const },
      { expiresIn: '365d' }
    );

    const tokenHash = crypto
      .createHash('sha256')
      .update(deviceToken)
      .digest('hex');

    const device = await prisma.device.create({
      data: {
        id: deviceId,
        companyId,
        operatorName,
        tokenHash,
        isActive: true
      }
    });

    request.log.info(`[devices] Nuevo device registrado: ${device.id} para company ${companyId}`);

    return reply.status(201).send({
      device_id: device.id,
      operator_name: device.operatorName,
      token: deviceToken
    });
  });

  // DELETE /admin/devices/:id — Revocar acceso de un operario
  fastify.delete('/admin/devices/:id', {
    preHandler: fastify.authenticate,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { id: companyId } = request.user;
    const { id: deviceId } = request.params as { id: string };

    // Buscar el device verificando que pertenezca a esta empresa — multi-tenancy
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      return reply.status(404).send({ error: 'Dispositivo no encontrado.' });
    }

    // Un admin no puede revocar devices de otra empresa
    if (device.companyId !== companyId) {
      request.log.warn(`[SECURITY] Company ${companyId} intentó revocar device ${deviceId} de otra empresa`);
      return reply.status(403).send({ error: 'No tenés permiso para revocar este dispositivo.' });
    }

    if (!device.isActive) {
      return reply.status(400).send({ error: 'El dispositivo ya estaba revocado.' });
    }

    const revoked = await prisma.device.update({
      where: { id: deviceId },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    });

    request.log.info(`[devices] Device revocado: ${revoked.id} por company ${companyId}`);

    return reply.status(200).send({
      message: 'Dispositivo revocado exitosamente.',
      device_id: revoked.id,
      operator_name: revoked.operatorName,
      revoked_at: revoked.revokedAt
    });
  });
}