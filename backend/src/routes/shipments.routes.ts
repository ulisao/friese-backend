// src/routes/shipment.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking.js';
import { confirmDelivery, initiateDispute } from '../services/receiver.js';
import { trackShipmentCreated } from '../services/usage.js';
import { sendTrackingEmail } from '../services/email.js';

type ProductoInput = {
  descripcion: string;
  lote?: string;
  cantidad: number;
  marca?: string;
  material?: string;
};

export async function shipmentRoutes(fastify: FastifyInstance) {

  // POST /shipments — Crear envío
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
                lote: { type: 'string' },
                cantidad: { type: 'number', minimum: 1 },
                marca: { type: 'string' },
                material: { type: 'string' }
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

    const shipment = await prisma.$transaction(async (tx) => {
      // trackingToken eliminado — ya no existe en el schema
      const newShipment = await tx.shipment.create({
        data: {
          receiverEmail: email,
          destinatario,
          trackingCode,
          companyId,
          createdByDevice: deviceId,
        }
      });

      await tx.shipmentItem.createMany({
        data: productos.map((p) => ({
          shipmentId: newShipment.id,
          descripcion: p.descripcion,
          lote: p.lote ?? null,
          cantidad: p.cantidad,
          marca: p.marca ?? null,
          material: p.material ?? null,
        }))
      });

      const items = await tx.shipmentItem.findMany({
        where: { shipmentId: newShipment.id },
        select: { id: true, descripcion: true, cantidad: true }
      });

      return { ...newShipment, items };
    });

    trackShipmentCreated(companyId, shipment.id);

    return reply.status(201).send({
      shipment_id: shipment.id,
      tracking_code: shipment.trackingCode,
      items: shipment.items
    });
  });

  // POST /shipments/:id/finalize — Operario finaliza la carga
  // Transiciona a IN_TRANSIT, crea el ReceiverLink y notifica al receptor
  fastify.post('/shipments/:id/finalize', {
    preHandler: fastify.authenticateDevice
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { companyId } = request.user;

    if (!companyId) {
      return reply.status(401).send({ error: 'Token de dispositivo inválido. Falta companyId.' });
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId }
    });

    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado.' });
    }

    if (shipment.companyId !== companyId) {
      request.log.warn(`[SECURITY] Device de company ${companyId} intentó finalizar shipment de company ${shipment.companyId}`);
      return reply.status(403).send({ error: 'No tenés permiso para operar sobre este envío.' });
    }

    if (shipment.status !== 'PENDING_EVIDENCE') {
      return reply.status(400).send({
        error: `El envío no puede finalizarse desde el estado ${shipment.status}.`
      });
    }

    const itemsWithEvidence = await prisma.evidence.findFirst({
      where: { shipmentId, type: 'DEPARTURE' }
    });

    if (!itemsWithEvidence) {
      return reply.status(400).send({
        error: 'No se puede finalizar el envío sin al menos una foto de evidencia.'
      });
    }

    // Crear ReceiverLink — es el token de acceso del receptor al portal de tracking
    // Se crea acá para que el receptor pueda ver el estado desde IN_TRANSIT en adelante
    // El mismo link se reutiliza cuando el admin marca DELIVERED
    const receiverLink = await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: 'IN_TRANSIT' }
      });

      await tx.auditLog.create({
        data: {
          shipmentId,
          fromStatus: 'PENDING_EVIDENCE',
          toStatus: 'IN_TRANSIT',
          actor: request.deviceId ?? companyId
        }
      });

      return tx.receiverLink.create({
        data: { shipmentId }
      });
    });

    // Email informativo al receptor — fire and forget
    sendTrackingEmail(
      shipment.receiverEmail,
      shipment.trackingCode,
      receiverLink.token,
      shipment.companyId
    );

    return reply.status(200).send({
      message: 'Envío finalizado. El receptor fue notificado por email.',
      status: 'IN_TRANSIT'
    });
  });

  // POST /shipments/:id/confirm — Receptor da conformidad
  fastify.post('/shipments/:id/confirm', {
    schema: {
      querystring: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { token } = request.query as { token: string };

    try {
      const result = await confirmDelivery(shipmentId, token, request.ip);
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
        properties: { token: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { token } = request.query as { token: string };

    try {
      const result = await initiateDispute(shipmentId, token, request.ip);
      return reply.status(200).send({
        message: 'Disputa iniciada. Escribí el siguiente código en un papel visible junto a la foto del reclamo:',
        ...result
      });
    } catch (err: any) {
      request.log.warn({ err }, `[receiver] dispute failed for shipment ${shipmentId}`);
      return reply.status(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // GET /shipments — Lista de envíos de la empresa autenticada
  fastify.get('/shipments', {
    preHandler: fastify.authenticate,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 }
        }
      }
    }
  }, async (request, reply) => {
    const { id: companyId } = request.user;
    const { status, page = 1, limit = 20 } = request.query as {
      status?: string;
      page?: number;
      limit?: number;
    };

    const where = {
      companyId,
      ...(status ? { status: status as any } : {})
    };

    const [shipments, total] = await prisma.$transaction([
      prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          trackingCode: true,
          status: true,
          destinatario: true,
          receiverEmail: true,
          deliveredAt: true,
          createdAt: true,
          _count: { select: { items: true } }
        }
      }),
      prisma.shipment.count({ where })
    ]);

    return reply.status(200).send({
      data: shipments,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  });
}