// src/routes/shipments.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
<<<<<<< HEAD
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import crypto from 'node:crypto';
=======
import { generateUniqueTrackingCode } from '../utils/generateTracking';
import crypto from 'node:crypto'; // <-- Faltaba importar esto
>>>>>>> feature/ticket-21-dispute-logic

export async function shipmentRoutes(fastify: FastifyInstance) {
  
  // Endpoint 1: Crear envío
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
<<<<<<< HEAD
    const trackingToken = crypto.randomUUID();
=======
    const trackingToken = crypto.randomUUID(); // <-- BOMBA 1 DESACTIVADA: Generamos el token
>>>>>>> feature/ticket-21-dispute-logic

    const newShipment = await prisma.shipment.create({
      data: {
        receiverEmail: email,
        trackingCode: trackingCode,
<<<<<<< HEAD
        trackingToken: trackingToken,
=======
        trackingToken: trackingToken, // <-- Lo guardamos en la DB
>>>>>>> feature/ticket-21-dispute-logic
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
<<<<<<< HEAD
      tracking_token: newShipment.trackingToken
    });
  });

  fastify.post('/shipments/:id/confirm', {
=======
      tracking_token: newShipment.trackingToken // <-- Lo devolvemos para que puedas copiarlo en Postman
    });
  });

  // Endpoint 2: Iniciar queja
  fastify.post('/shipments/:id/complaint', {
>>>>>>> feature/ticket-21-dispute-logic
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
<<<<<<< HEAD
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
=======
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
          expiresAt: expiresAt // <-- BOMBA 2 DESACTIVADA: Le pasamos la fecha a Prisma
        }
>>>>>>> feature/ticket-21-dispute-logic
      }),
      prisma.auditLog.create({
        data: {
          shipmentId,
          fromStatus: shipment.status,
<<<<<<< HEAD
          toStatus: 'CLOSED',
=======
          toStatus: 'DISPUTE',
>>>>>>> feature/ticket-21-dispute-logic
          actor: 'cliente_final'
        }
      })
    ]);

    return reply.status(200).send({
<<<<<<< HEAD
      message: 'Conformidad registrada. Envío cerrado exitosamente.',
      status: 'CLOSED'
=======
      message: 'Disputa iniciada. Por favor, suba una foto del reclamo incluyendo el siguiente código escrito en un papel visible:',
      visual_token: visualToken,
      expires_at: expiresAt
>>>>>>> feature/ticket-21-dispute-logic
    });
  });
}