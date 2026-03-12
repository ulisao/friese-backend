// src/routes/shipments.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import crypto from 'node:crypto';

export async function shipmentRoutes(fastify: FastifyInstance) {
  
  // 1. CREAR ENVÍO
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

  // 2. CONFIRMAR / CERRAR ENVÍO
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

    const shipment = await prisma.shipment.findUnique({ 
      where: { id: shipmentId } 
    });

    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    if (token !== shipment.trackingToken) {
      request.log.warn(`[SECURITY] Intento de cierre no autorizado para shipment ${shipmentId}`);
      return reply.status(401).send({ error: 'No autorizado. Token de confirmación inválido.' });
    }

    if (shipment.status === 'CLOSED') {
      return reply.status(400).send({ error: 'El envío ya se encuentra cerrado.' });
    }

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

  // 3. INICIAR RECLAMO
  fastify.post('/shipments/:id/complaint', {
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
    const { token: trackingToken } = request.query as { token: string };

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

    if (!shipment) return reply.status(404).send({ error: 'Envío no encontrado' });
    if (trackingToken !== shipment.trackingToken) return reply.status(401).send({ error: 'No autorizado' });
    if (shipment.status === 'CLOSED') {
      return reply.status(400).send({ error: 'No se puede abrir una disputa sobre un envío que ya fue cerrado y entregado.' });
    }

    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let visualToken = '';
    for (let i = 0; i < 4; i++) {
      visualToken += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const expiresAt = new Date(Date.now() + 10 * 60000); 

    await prisma.$transaction([
      prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: 'DISPUTE' }
      }),
      prisma.disputeToken.create({
        data: {
          shipmentId,
          visualToken: visualToken, 
          generatedAt: new Date(),
          expiresAt: expiresAt
        }
      }),
      prisma.auditLog.create({
        data: {
          shipmentId,
          fromStatus: shipment.status,
          toStatus: 'DISPUTE',
          actor: 'cliente_final'
        }
      })
    ]);

    return reply.status(200).send({
      message: 'Disputa iniciada. Por favor, suba una foto del reclamo incluyendo el siguiente código escrito en un papel visible:',
      visual_token: visualToken,
      expires_at: expiresAt
    });
  });
}