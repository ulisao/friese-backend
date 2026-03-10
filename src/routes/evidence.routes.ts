// src/routes/evidence.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { processEvidenceImage } from '../workers/evidenceWorker';
import fs from 'node:fs';
import util from 'node:util';
import { pipeline } from 'node:stream';
import path from 'node:path';
import crypto from 'node:crypto';

const pump = util.promisify(pipeline);

const calculateFileHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

export async function evidenceRoutes(fastify: FastifyInstance) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  fastify.post('/shipments/:id/evidence', async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No se envió ningún archivo' });
    }

    if (!data.mimetype.startsWith('image/') && !data.mimetype.startsWith('video/')) {
      return reply.status(400).send({ error: 'Tipo de archivo inválido. Solo imágenes o videos.' });
    }

    const hash = data.fields.hash && 'value' in data.fields.hash ? data.fields.hash.value : '';
    const metadataRaw = data.fields.metadata && 'value' in data.fields.metadata ? data.fields.metadata.value as string : '{}';
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

    if (evidenceTypeRaw !== 'DEPARTURE' && evidenceTypeRaw !== 'COMPLAINT') {
      return reply.status(400).send({ error: 'El campo type debe ser DEPARTURE o COMPLAINT' });
    }

    const fileName = `${Date.now()}-${data.filename}`;
    const filePath = path.join(uploadDir, fileName);
    await pump(data.file, fs.createWriteStream(filePath));

    const calculatedHash = await calculateFileHash(filePath);

    if (calculatedHash !== hash) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Hash mismatch en evidencia para shipment ${shipmentId}. Esperado: ${hash}, Calculado: ${calculatedHash}`);
      return reply.status(422).send({ 
        error: 'Error de integridad: El hash del archivo no coincide. La imagen puede estar corrupta o haber sido modificada en tránsito.' 
      });
    }

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

    return reply.status(202).send({
      message: 'Evidencia recibida y verificada exitosamente',
      evidence_id: evidence.id
    });
  });
}