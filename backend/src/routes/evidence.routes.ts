// src/routes/evidence.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { processEvidenceImage } from '../workers/evidenceWorker.js';
import { linkDisputeEvidence } from '../services/receiver.js';
import { trackEvidenceUploaded } from '../services/usage.js';
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
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  // POST /shipments/:id/evidence?itemId=<uuid>
  fastify.post('/shipments/:id/evidence', {
    preHandler: fastify.authenticateDevice,
    config: {
      rateLimit: { max: 20, timeWindow: '10 minute' }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { itemId } = request.query as { itemId?: string };
    const { companyId } = request.user;

    if (!companyId) {
      return reply.status(401).send({ error: 'Token de dispositivo inválido. Falta companyId.' });
    }

    if (!itemId) {
      return reply.status(400).send({ error: 'El parámetro itemId es obligatorio.' });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado.' });
    }

    if (shipment.companyId !== companyId) {
      request.log.warn(`[SECURITY] Device de company ${companyId} intentó subir evidencia de shipment de company ${shipment.companyId}`);
      return reply.status(403).send({ error: 'No tenés permiso para operar sobre este envío.' });
    }

    const item = await prisma.shipmentItem.findUnique({ where: { id: itemId } });
    if (!item || item.shipmentId !== shipmentId) {
      return reply.status(404).send({ error: 'Producto no encontrado en este envío.' });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No se envió ningún archivo.' });

    if (!data.mimetype.startsWith('image/') && !data.mimetype.startsWith('video/')) {
      return reply.status(400).send({ error: 'Tipo de archivo inválido. Solo imágenes o videos.' });
    }

    const hash = data.fields.hash && 'value' in data.fields.hash ? data.fields.hash.value : '';
    const metadataRaw = data.fields.metadata && 'value' in data.fields.metadata
      ? data.fields.metadata.value as string : '{}';

    let metadata = {};
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return reply.status(400).send({ error: 'El campo metadata debe ser un JSON válido.' });
    }

    if (!hash) return reply.status(400).send({ error: 'El hash SHA-256 es obligatorio.' });

    const fileName = `${Date.now()}-${data.filename}`;
    const filePath = path.join(uploadDir, fileName);
    await pump(data.file, fs.createWriteStream(filePath));

    const { fileTypeFromFile } = await import('file-type');
    const realFileType = await fileTypeFromFile(filePath);

    if (!realFileType || !allowedMimes.includes(realFileType.mime)) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] MIME real rechazado: ${realFileType?.mime ?? 'desconocido'}`);
      return reply.status(415).send({ error: 'Unsupported Media Type. El archivo está corrupto o tiene extensión falsa.' });
    }

    const calculatedHash = await calculateFileHash(filePath);
    if (calculatedHash !== hash) {
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Hash mismatch para shipment ${shipmentId}, item ${itemId}`);
      return reply.status(422).send({ error: 'Error de integridad: el hash del archivo no coincide.' });
    }

    // Tamaño del archivo para metering de storage
    const { size: fileSizeBytes } = fs.statSync(filePath);

    const evidence = await prisma.evidence.create({
      data: {
        shipmentId,
        shipmentItemId: itemId,
        fileUrl: `/uploads/${fileName}`,
        fileHash: String(hash),
        fileSizeBytes,
        metadataJson: metadata,
        type: 'DEPARTURE'
      }
    });

    // Metering — fire and forget
    trackEvidenceUploaded(companyId, evidence.id, fileSizeBytes);

    processEvidenceImage(evidence.id, filePath, data.mimetype);

    return reply.status(202).send({
      message: 'Evidencia recibida y verificada exitosamente.',
      evidence_id: evidence.id,
      item_id: itemId
    });
  });

  // POST /shipments/:id/complaint/photo
  fastify.post('/shipments/:id/complaint/photo', {
    config: {
      rateLimit: { max: 3, timeWindow: '10 minute' }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const ipAddress = request.ip;

    const activeToken = await prisma.disputeToken.findFirst({
      where: { shipmentId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { generatedAt: 'desc' }
    });

    if (!activeToken) {
      return reply.status(400).send({ error: 'No se encontró un token visual válido o ya expiró. Iniciá un nuevo reclamo.' });
    }

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No se envió ninguna foto.' });
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
      request.log.warn(`[SECURITY] MIME real rechazado: ${realFileType?.mime ?? 'desconocido'}`);
      return reply.status(415).send({ error: 'Unsupported Media Type. El archivo está corrupto o tiene extensión falsa.' });
    }

    const calculatedHash = await calculateFileHash(filePath);
    const finalFileUrl = `/uploads/${fileName}`;
    const { size: fileSizeBytes } = fs.statSync(filePath);

    const transactionResults = await prisma.$transaction([
      prisma.disputeToken.update({
        where: { id: activeToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.evidence.create({
        data: {
          shipmentId,
          shipmentItemId: null,
          fileUrl: finalFileUrl,
          fileHash: calculatedHash,
          fileSizeBytes,
          metadataJson: { source: 'complaint_flow', visual_token: activeToken.visualToken },
          type: 'COMPLAINT'
        }
      })
    ]);

    const evidence = transactionResults[1];

    // Metering — obtenemos companyId desde el shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { companyId: true }
    });
    if (shipment) {
      trackEvidenceUploaded(shipment.companyId, evidence.id, fileSizeBytes);
    }

    try {
      await linkDisputeEvidence(shipmentId, activeToken.id, evidence.id, ipAddress);
    } catch (err: any) {
      request.log.warn({ err }, `[receiver] linkDisputeEvidence failed for shipment ${shipmentId}`);
    }

    processEvidenceImage(evidence.id, filePath, data.mimetype);

    return reply.status(201).send({
      message: 'Foto de queja recibida. Tu reclamo ha sido registrado exitosamente.',
      visual_token_used: activeToken.visualToken,
      evidence_id: evidence.id,
      file_url: finalFileUrl
    });
  });
}