// src/routes/tracking.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateSignedUrl } from '../services/storage.js';

export async function trackingRoutes(fastify: FastifyInstance) {

  fastify.get('/tracking/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const { token } = request.query as { token?: string };

    const shipment = await prisma.shipment.findUnique({
      where: { trackingCode: code },
      include: {
        receiverLink: true,
        items: {
          include: {
            evidence: {
              where: { type: 'DEPARTURE' },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        evidence: {
          where: { type: 'COMPLAINT' } // fotos de queja del receptor
        },
        auditLogs: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado.' });
    }

    if (!token || !shipment.receiverLink || shipment.receiverLink.token !== token || shipment.receiverLink.invalidated) {
      request.log.warn(`[SECURITY] Intento de acceso no autorizado al tracking ${code}`);
      return reply.status(401).send({ error: 'No autorizado. Token de seguimiento inválido o ausente.' });
    }

    // Generar signed URLs para las fotos de cada item
    const itemsWithUrls = await Promise.all(
      shipment.items.map(async (item) => {
        const evidenceWithUrls = await Promise.all(
          item.evidence.map(async (ev) => {
            let url = ev.fileUrl;
            if (url.startsWith('shipments/')) {
              url = await generateSignedUrl(url, 3600);
            } else if (url.startsWith('/uploads/')) {
              url = `http://localhost:3000${url}`;
            }
            return { id: ev.id, url, hash: ev.fileHash, createdAt: ev.createdAt };
          })
        );

        return {
          id:          item.id,
          descripcion: item.descripcion,
          lote:        item.lote,
          cantidad:    item.cantidad,
          marca:       item.marca,
          material:    item.material,
          evidence:    evidenceWithUrls
        };
      })
    );

    // Signed URLs para fotos de queja (si hay disputa)
    const complaintEvidenceWithUrls = await Promise.all(
      shipment.evidence.map(async (ev) => {
        let url = ev.fileUrl;
        if (url.startsWith('shipments/')) {
          url = await generateSignedUrl(url, 3600);
        } else if (url.startsWith('/uploads/')) {
          url = `http://localhost:3000${url}`;
        }
        return { id: ev.id, url, hash: ev.fileHash, createdAt: ev.createdAt };
      })
    );

    return reply.status(200).send({
      id:               shipment.id,
      tracking_code:    shipment.trackingCode,
      status:           shipment.status,
      destinatario:     shipment.destinatario,
      metadata:         shipment.metadata,
      created_at:       shipment.createdAt,
      items:            itemsWithUrls,
      complaint_evidence: complaintEvidenceWithUrls,
      audit_logs:       shipment.auditLogs
    });
  });
}