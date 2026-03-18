// src/routes/evidence.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { processEvidenceImage } from '../workers/evidenceWorker.js';
import { linkDisputeEvidence } from '../services/receiver.service.js';
import fs from 'node:fs';
import util from 'node:util';
import { pipeline } from 'node:stream';
import path from 'node:path';
import { calculateFileHash } from '../utils/filehash.js';

const pump = util.promisify(pipeline);

const allowedMimes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime'
];

export async function evidenceRoutes(fastify: FastifyInstance) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  // ---------------------------------------------------------------------------
  // POST /shipments/:id/evidence
  // Evidencia de despacho — sube el operario al momento de crear el envío
  // ---------------------------------------------------------------------------
  fastify.post('/shipments/:id/evidence', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '10 minute'
      }
    }
  }, async (request, reply) => {
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

    const hash = data.fields.hash && 'value' in data.fields.hash
      ? data.fields.hash.value
      : '';
    const metadataRaw = data.fields.metadata && 'value' in data.fields.metadata
      ? data.fields.metadata.value as string
      : '{}';
    const evidenceTypeRaw = data.fields.type && 'value' in data.fields.type
      ? data.fields.type.value as string
      : 'DEPARTURE';

    let metadata = {};
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
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

    const { fileTypeFromFile } = await import('file-type');
    const realFileType = await fileTypeFromFile(filePath);

    if (!realFileType || !allowedMimes.includes(realFileType.mime)) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Intento de subida rechazado. MIME real: ${realFileType?.mime ?? 'desconocido'}`);
      return reply.status(415).send({
        error: 'Unsupported Media Type. El archivo está corrupto o tiene una extensión falsa.'
      });
    }

    const calculatedHash = await calculateFileHash(filePath);
    if (calculatedHash !== hash) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Hash mismatch en evidencia para shipment ${shipmentId}`);
      return reply.status(422).send({
        error: 'Error de integridad: el hash del archivo no coincide.'
      });
    }

    const evidence = await prisma.evidence.create({
      data: {
        shipmentId,
        fileUrl: `/uploads/${fileName}`,
        fileHash: String(hash),
        metadataJson: metadata,
        type: evidenceTypeRaw as 'DEPARTURE' | 'COMPLAINT'
      }
    });

    processEvidenceImage(evidence.id, filePath, data.mimetype);

    return reply.status(202).send({
      message: 'Evidencia recibida y verificada exitosamente',
      evidence_id: evidence.id
    });
  });

  // ---------------------------------------------------------------------------
  // POST /shipments/:id/complaint/photo
  // Foto de queja del receptor — paso 2 del flujo de disputa
  // ---------------------------------------------------------------------------
  fastify.post('/shipments/:id/complaint/photo', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '10 minute'
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const ipAddress = request.ip;

    // 1. Verificar que existe un DisputeToken activo y no expirado
    const activeToken = await prisma.disputeToken.findFirst({
      where: {
        shipmentId,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { generatedAt: 'desc' }
    });

    if (!activeToken) {
      return reply.status(400).send({
        error: 'No se encontró un token visual válido o ya expiró. Iniciá un nuevo reclamo.'
      });
    }

    // 2. Recibir y validar el archivo
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No se envió ninguna foto.' });
    }

    if (!data.mimetype.startsWith('image/')) {
      return reply.status(400).send({ error: 'El archivo de la queja debe ser una imagen.' });
    }

    const fileExtension = path.extname(data.filename) || '.jpg';
    const fileName = `queja_token_${activeToken.visualToken}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    await pump(data.file, fs.createWriteStream(filePath));

    const { fileTypeFromFile } = await import('file-type');
    const realFileType = await fileTypeFromFile(filePath);

    if (!realFileType || !allowedMimes.includes(realFileType.mime)) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Intento de subida rechazado. MIME real: ${realFileType?.mime ?? 'desconocido'}`);
      return reply.status(415).send({
        error: 'Unsupported Media Type. El archivo está corrupto o tiene una extensión falsa.'
      });
    }

    const calculatedHash = await calculateFileHash(filePath);
    const finalFileUrl = `/uploads/${fileName}`;

    // 3. Transacción: quemar el token + crear la Evidence
    const transactionResults = await prisma.$transaction([
      prisma.disputeToken.update({
        where: { id: activeToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.evidence.create({
        data: {
          shipmentId,
          fileUrl: finalFileUrl,
          fileHash: calculatedHash,
          metadataJson: { source: 'complaint_flow', visual_token: activeToken.visualToken },
          type: 'COMPLAINT'
        }
      })
    ]);

    const evidence = transactionResults[1];

    // 4. Flujo completo → registrar ReceiverAction con todo vinculado
    try {
      await linkDisputeEvidence(shipmentId, activeToken.id, evidence.id, ipAddress);
    } catch (err: any) {
      // Si ya existía un ReceiverAction es un caso raro pero no crítico —
      // la Evidence ya fue creada y el token quemado, solo logueamos.
      request.log.warn({ err }, `[receiver] linkDisputeEvidence failed for shipment ${shipmentId}`);
    }

    // 5. Procesar imagen de forma asíncrona
    processEvidenceImage(evidence.id, filePath, data.mimetype);

    return reply.status(201).send({
      message: 'Foto de queja recibida. Tu reclamo ha sido registrado exitosamente.',
      visual_token_used: activeToken.visualToken,
      evidence_id: evidence.id,
      file_url: finalFileUrl
    });
  });
}