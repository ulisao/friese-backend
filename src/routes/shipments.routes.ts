// src/routes/shipments.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import crypto from 'node:crypto';

export async function shipmentRoutes(fastify: FastifyInstance) {
  fastify.post('/shipments', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'destinatario', 'lote', 'cantidad'],
        properties: {
          email: { type: 'string', format: 'email' },
          destinatario: { type: 'string' },
          lote: { type: 'string' },
          cantidad: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, destinatario, lote, cantidad } = request.body as {
      email: string;
      destinatario: string;
      lote: string;
      cantidad: number;
    };

    const trackingCode = await generateUniqueTrackingCode();
    const trackingToken = crypto.randomUUID();

    const newShipment = await prisma.shipment.create({
      data: {
        receiverEmail: email,
        trackingCode: trackingCode,
        trackingToken: trackingToken,
        metadata: {
          destinatario,
          lote,
          cantidad
        }
      }
    });

    return reply.status(201).send({
      shipment_id: newShipment.id,
      tracking_code: newShipment.trackingCode,
      tracking_token: newShipment.trackingToken
    });
  });

  fastify.post('/shipments/:id/confirm', {
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
    const { id: shipmentId } = request.params as { id: string };
    const { token } = request.query as { token: string };

    // 1. Buscamos el envío para validar existencia y token
    const shipment = await prisma.shipment.findUnique({ 
      where: { id: shipmentId } 
    });

    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    // Mejora de seguridad: Validamos que el token coincida
    if (token !== shipment.trackingToken) {
      request.log.warn(`[SECURITY] Intento de cierre no autorizado para shipment ${shipmentId}`);
      return reply.status(401).send({ error: 'No autorizado. Token de confirmación inválido.' });
    }

    // Evitamos cerrar algo que ya está cerrado o en disputa
    if (shipment.status === 'CLOSED') {
      return reply.status(400).send({ error: 'El envío ya se encuentra cerrado.' });
    }

    // 2. Transacción para asegurar integridad
    await prisma.$transaction([
      prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: 'CLOSED' }
      }),
      prisma.auditLog.create({
        data: {
          shipmentId,
          fromStatus: shipment.status,
          toStatus: 'CLOSED',
          actor: 'cliente_final'
        }
      })
    ]);

    return reply.status(200).send({
      message: 'Conformidad registrada. Envío cerrado exitosamente.',
      status: 'CLOSED'
    });
  });
}