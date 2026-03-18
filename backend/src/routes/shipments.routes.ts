// src/routes/shipment.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import { confirmDelivery, initiateDispute } from '../services/receiver.js';
import crypto from 'node:crypto';

export async function shipmentRoutes(fastify: FastifyInstance) {

  // POST /shipments — Crear envío
  fastify.post('/shipments', {
    preHandler: fastify.authenticateDevice,
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
    const { id: deviceId, companyId } = request.user;

    if (!companyId) {
      return reply.status(401).send({ error: 'Token de dispositivo inválido. Falta companyId.' });
    }

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
        trackingCode,
        trackingToken,
        companyId,
        createdByDevice: deviceId,
        metadata: { destinatario, lote, cantidad }
      }
    });

    return reply.status(201).send({
      shipment_id: newShipment.id,
      tracking_code: newShipment.trackingCode,
      tracking_token: newShipment.trackingToken
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