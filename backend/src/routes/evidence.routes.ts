// src/routes/evidence.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { processEvidenceImage } from '../workers/evidenceWorker';
import fs from 'node:fs';
import util from 'node:util';
import { pipeline } from 'node:stream';
import path from 'node:path';
import { calculateFileHash } from '../utils/filehash.js';

const pump = util.promisify(pipeline);

export async function evidenceRoutes(fastify: FastifyInstance) {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  fastify.post('/shipments/:id/evidence', {
    config: {
      rateLimit: {
        max: 5, // Máximo 5 fotos
        timeWindow: '10 minute' // Por IP cada 10 minutos
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

    const { fileTypeFromFile } = await import('file-type');
    const realFileType = await fileTypeFromFile(filePath);
    
    // Definimos los verdaderos tipos que aceptamos
    const allowedMimes = [
      'image/jpeg', 
      'image/png', 
      'image/webp', 
      'video/mp4', 
      'video/quicktime' // MOV
    ];

    // Si no pudimos leer la firma o no está en la lista blanca, lo fletamos
    if (!realFileType || !allowedMimes.includes(realFileType.mime)) {
      // Borramos la basura maliciosa del servidor inmediatamente
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Intento de subida rechazado. MIME real detectado: ${realFileType?.mime || 'desconocido'}`);
      
      return reply.status(415).send({ 
        error: 'Unsupported Media Type. El archivo está corrupto o tiene una extensión falsa. Solo se permiten archivos JPG, PNG, WEBP, MP4 y MOV reales.' 
      });
    }

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

  fastify.post('/shipments/:id/complaint/photo', {
    config: {
      rateLimit: {
        max: 3, 
        timeWindow: '10 minute'
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };

    // 1. Verificar si hay un token activo y no expirado para este envío
    const activeToken = await prisma.disputeToken.findFirst({
      where: {
        shipmentId,
        usedAt: null,
        expiresAt: { gt: new Date() } // Que la fecha de expiración sea mayor a AHORA
      },
      orderBy: { generatedAt: 'desc' }
    });

    if (!activeToken) {
      return reply.status(400).send({
        error: 'No se encontró un token visual válido o ya expiró (pasaron los 10 minutos). Inicie un nuevo reclamo.'
      });
    }

    // 2. Recibir el archivo
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No se envió ninguna foto.' });
    }

    if (!data.mimetype.startsWith('image/')) {
      return reply.status(400).send({ error: 'El archivo de la queja debe ser una imagen.' });
    }

    // 3. Simular la subida a S3 (Por ahora lo guardamos local)
    // Usamos exactamente el formato que pide el ticket: queja_token_{token}.jpg
    const fileExtension = path.extname(data.filename) || '.jpg';
    const fileName = `queja_token_${activeToken.visualToken}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    await pump(data.file, fs.createWriteStream(filePath));

    const { fileTypeFromFile } = await import('file-type');
    const realFileType = await fileTypeFromFile(filePath);
    
    // Definimos los verdaderos tipos que aceptamos
    const allowedMimes = [
      'image/jpeg', 
      'image/png', 
      'image/webp', 
      'video/mp4', 
      'video/quicktime' // MOV
    ];

    // Si no pudimos leer la firma o no está en la lista blanca, lo fletamos
    if (!realFileType || !allowedMimes.includes(realFileType.mime)) {
      // Borramos la basura maliciosa del servidor inmediatamente
      fs.unlinkSync(filePath);
      request.log.warn(`[SECURITY] Intento de subida rechazado. MIME real detectado: ${realFileType?.mime || 'desconocido'}`);
      
      return reply.status(415).send({ 
        error: 'Unsupported Media Type. El archivo está corrupto o tiene una extensión falsa. Solo se permiten archivos JPG, PNG, WEBP, MP4 y MOV reales.' 
      });
    }

    // Como el schema pide un hash obligatorio, lo calculamos igual (nunca viene mal)
    const calculatedHash = await calculateFileHash(filePath);

    // ==========================================
    // 🚧 TODO: [CLOUDFLARE R2 / AWS S3] 🚧
    // Cuando te crees la cuenta, reemplazá el fs.createWriteStream de arriba
    // por la subida a R2 usando @aws-sdk/client-s3.
    // Ejemplo:
    // await s3Client.send(new PutObjectCommand({
    //   Bucket: 'friese-bucket',
    //   Key: fileName,
    //   Body: buffer,
    //   ContentType: data.mimetype
    // }));
    // const fileUrl = `https://tu-url-de-r2.com/${fileName}`;
    // ==========================================

    const finalFileUrl = `/uploads/${fileName}`; // Cambiar por fileUrl de R2 a futuro

    // 4. Transacción: Quemar el token y crear la evidencia
    // Capturamos el resultado de la transacción
    const transactionResults = await prisma.$transaction([
      prisma.disputeToken.update({
        where: { id: activeToken.id },
        data: { usedAt: new Date() } // Marcamos el token como utilizado
      }),
      prisma.evidence.create({
        data: {
          shipmentId,
          fileUrl: finalFileUrl,
          fileHash: calculatedHash,
          metadataJson: { source: 'complaint_flow', visual_token: activeToken.visualToken },
          type: 'COMPLAINT' // Tipo de evidencia específica de queja
        }
      })
    ]);

    // Extraemos el registro de evidencia creado (es el segundo ítem del array de la transacción)
    const evidence = transactionResults[1];

    // 👇 AGREGA ESTA LÍNEA ACÁ 👇
    // 5. Disparamos el worker asíncrono para redimensionar, poner watermark y subir a S3/Local fallback
    processEvidenceImage(evidence.id, filePath, data.mimetype);

    return reply.status(201).send({
      message: 'Foto de queja recibida correctamente, verificada y enviada a procesamiento.',
      visual_token_used: activeToken.visualToken,
      evidence_id: evidence.id, // Está bueno devolver el ID de evidencia
      file_url: finalFileUrl
    });
  });
}