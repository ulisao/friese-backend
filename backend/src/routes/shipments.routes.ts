// src/routes/shipment.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import { confirmDelivery, initiateDispute } from '../services/receiver.js';
import crypto from 'node:crypto';

type ProductoInput = {
  descripcion: string;
  lote?: string;
  cantidad: number;
  marca?: string;
  material?: string;
};

export async function shipmentRoutes(fastify: FastifyInstance) {

  // POST /shipments — Crear envío con uno o más productos
  fastify.post('/shipments', {
    preHandler: fastify.authenticateDevice,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'destinatario', 'productos'],
        properties: {
          email: { type: 'string', format: 'email' },
          destinatario: { type: 'string' },
          productos: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['descripcion', 'cantidad'],
              properties: {
                descripcion: { type: 'string' },
                lote:        { type: 'string' },
                cantidad:    { type: 'number', minimum: 1 },
                marca:       { type: 'string' },
                material:    { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id: deviceId, companyId } = request.user;

    if (!companyId) {
      return reply.status(401).send({ error: 'Token de dispositivo inválido. Falta companyId.' });
    }

    const { email, destinatario, productos } = request.body as {
      email: string;
      destinatario: string;
      productos: ProductoInput[];
    };

    const trackingCode = await generateUniqueTrackingCode();
    const trackingToken = crypto.randomUUID();

    // Creamos el Shipment y todos sus items en una sola transacción
    const shipment = await prisma.$transaction(async (tx) => {
      const newShipment = await tx.shipment.create({
        data: {
          receiverEmail: email,
          destinatario,
          trackingCode,
          trackingToken,
          companyId,
          createdByDevice: deviceId,
        }
      });

      await tx.shipmentItem.createMany({
        data: productos.map((p) => ({
          shipmentId:  newShipment.id,
          descripcion: p.descripcion,
          lote:        p.lote ?? null,
          cantidad:    p.cantidad,
          marca:       p.marca ?? null,
          material:    p.material ?? null,
        }))
      });

      // Traemos los items creados para devolver sus IDs al frontend
      const items = await tx.shipmentItem.findMany({
        where: { shipmentId: newShipment.id },
        select: { id: true, descripcion: true, cantidad: true }
      });

      return { ...newShipment, items };
    });

    // El frontend usa los item IDs para asociar cada foto al producto correcto
    return reply.status(201).send({
      shipment_id:    shipment.id,
      tracking_code:  shipment.trackingCode,
      tracking_token: shipment.trackingToken,
      items:          shipment.items
    });
  });

  // POST /shipments/:id/confirm — Receptor da conformidad
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
    const ipAddress = request.ip;

    try {
      const result = await confirmDelivery(shipmentId, token, ipAddress);
      return reply.status(200).send({
        message: 'Conformidad registrada. Envío cerrado exitosamente.',
        ...result
      });
    } catch (err: any) {
      request.log.warn({ err }, `[receiver] confirm failed for shipment ${shipmentId}`);
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // POST /shipments/:id/complaint — Receptor inicia disputa
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
    const { token } = request.query as { token: string };
    const ipAddress = request.ip;

    try {
      const result = await initiateDispute(shipmentId, token, ipAddress);
      return reply.status(200).send({
        message: 'Disputa iniciada. Escribí el siguiente código en un papel visible junto a la foto del reclamo:',
        ...result
      });
    } catch (err: any) {
      request.log.warn({ err }, `[receiver] dispute failed for shipment ${shipmentId}`);
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });
}