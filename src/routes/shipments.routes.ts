import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { generateUniqueTrackingCode } from '../utils/generateTracking';
import fs from 'node:fs';
import util from 'node:util';
import { pipeline } from 'node:stream';
import path from 'node:path';
import { processEvidenceImage } from '../workers/evidenceWorker';

const pump = util.promisify(pipeline);

export async function evidenceRoutes(fastify: FastifyInstance) {
  // Aseguramos que exista la carpeta de uploads localmente
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  fastify.post('/shipments/:id/evidence', async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };

    // Validamos que el envío exista
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    // request.file() procesa el multipart como un stream (ideal para videos pesados)
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No se envió ningún archivo' });
    }

    // Validar tipo de archivo (solo imagen o video)
    if (!data.mimetype.startsWith('image/') && !data.mimetype.startsWith('video/')) {
      return reply.status(400).send({ error: 'Tipo de archivo inválido. Solo imágenes o videos.' });
    }

    // Extraer campos de texto enviados junto con el archivo
    // Nota: El cliente DEBE mandar los campos de texto antes que el archivo en el form-data
    const hash = data.fields.hash && 'value' in data.fields.hash ? data.fields.hash.value : '';
    const metadataRaw = data.fields.metadata && 'value' in data.fields.metadata ? data.fields.metadata.value as string : '{}';
    
    // Capturamos el tipo de evidencia (por defecto asumimos que es de salida si no lo mandan)
    const evidenceTypeRaw = data.fields.type && 'value' in data.fields.type ? data.fields.type.value as string : 'DEPARTURE';
    
    let metadata = {};
    try {
      metadata = JSON.parse(metadataRaw);
    } catch (e) {
      return reply.status(400).send({ error: 'El campo metadata debe ser un JSON válido' });
    }

    if (!hash) {
      return reply.status(400).send({ error: 'El hash SHA-256 es obligatorio' });
    }

    // Validamos que el enum sea correcto para evitar errores en la base de datos
    if (evidenceTypeRaw !== 'DEPARTURE' && evidenceTypeRaw !== 'COMPLAINT') {
      return reply.status(400).send({ error: 'El campo type debe ser DEPARTURE o COMPLAINT' });
    }

    // Guardar el archivo localmente
    const fileName = `${Date.now()}-${data.filename}`;
    const filePath = path.join(uploadDir, fileName);
    await pump(data.file, fs.createWriteStream(filePath));

    // Guardar en la base de datos
    const evidence = await prisma.evidence.create({
      data: {
        shipmentId,
        fileUrl: `/uploads/${fileName}`,
        fileHash: String(hash),
        metadataJson: metadata,
        type: evidenceTypeRaw as 'DEPARTURE' | 'COMPLAINT',
      }
    });
 
    processEvidenceImage(evidence.id, filePath, data.mimetype);

    // 202 Accepted significa: "Recibido, lo estamos procesando"
    return reply.status(202).send({
      message: 'Evidencia recibida y encolada para procesamiento',
      evidence_id: evidence.id
    });
  });
}

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

    const newShipment = await prisma.shipment.create({
      data: {
        receiverEmail: email,
        trackingCode: trackingCode,
        metadata: {
          destinatario,
          lote,
          cantidad
        }
      }
    });

    return reply.status(201).send({
      shipment_id: newShipment.id,
      tracking_code: newShipment.trackingCode
    });
  });
}