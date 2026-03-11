
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateSignedUrl } from '../services/storage';

export async function trackingRoutes(fastify: FastifyInstance) {
  
  fastify.get('/tracking/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const { token } = request.query as { token?: string };

    // 1. Buscamos el envío y nos traemos las evidencias y la auditoría
    const shipment = await prisma.shipment.findUnique({
      where: { trackingCode: code },
      include: {
        evidence: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' } // Traemos el historial ordenado del más nuevo al más viejo
        }
      }
    });

    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    // 2. Validación de Seguridad (Ticket 19)
    if (!token || token !== shipment.trackingToken) {
      request.log.warn(`[SECURITY] Intento de acceso no autorizado al tracking ${code}`);
      return reply.status(401).send({ error: 'No autorizado. Token de seguimiento inválido o ausente.' });
    }

    // 3. Generar URLs Firmadas (Signed URLs) para las fotos/videos
    // Como las fotos están privadas en Cloudflare R2, generamos un link que expira en 1 hora.
    const evidenceWithUrls = await Promise.all(shipment.evidence.map(async (ev) => {
      let temporalUrl = ev.fileUrl;
      
      // Si la URL es un path de R2 (ej: shipments/2026-03/...) le generamos la firma
      if (temporalUrl && temporalUrl.startsWith('shipments/')) {
        temporalUrl = await generateSignedUrl(temporalUrl, 3600);
      } else if (temporalUrl && temporalUrl.startsWith('/uploads/')) {
        // Fallback: Si todavía es un archivo local (porque no configuraste R2 aún), armamos la URL local
        temporalUrl = `http://localhost:3000${temporalUrl}`;
      }

      return {
        id: ev.id,
        type: ev.type,
        url: temporalUrl, // Entregamos la URL firmada o local lista para usar
        createdAt: ev.createdAt
      };
    }));

    // 4. Armamos el paquete de respuesta final
    return reply.status(200).send({
      id: shipment.id,
      tracking_code: shipment.trackingCode,
      status: shipment.status,
      metadata: shipment.metadata,
      created_at: shipment.createdAt,
      evidence: evidenceWithUrls,
      audit_logs: shipment.auditLogs
    });
  });
}