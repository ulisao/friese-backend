// src/workers/evidenceWorker.ts
import { prisma } from '../db.js'; // O '../db' si no usás la extensión .js
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

export const processEvidenceImage = async (
  evidenceId: string, 
  tempFilePath: string, 
  mimetype: string
) => {
  try {
    console.log(`[WORKER] ⚙️ Iniciando procesamiento para evidencia: ${evidenceId}`);

    if (mimetype.startsWith('video/')) {
      console.log(`[WORKER] 🎥 Archivo de video detectado. Omitiendo marca de agua.`);
      return;
    }

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId }
    });

    if (!evidence) throw new Error('Evidencia no encontrada en DB');

    // 1. Usamos la hora del servidor (como la app obliga a sacar foto en vivo, es exacta)
    const dateText = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' });
    
    // 2. Extraemos el GPS del JSON que mandó el cliente
    const metadata = (evidence.metadataJson as Record<string, any>) || {};
    const gpsData = metadata.gps ? `GPS: ${metadata.gps}` : 'GPS: No disponible';

    // 3. Aplicamos la marca de agua con Sharp
    const image = sharp(tempFilePath);
    const imageMetadata = await image.metadata();
    const width = imageMetadata.width || 800;
    const height = imageMetadata.height || 600;

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <style>
          .watermark { 
            fill: white; 
            font-size: ${Math.max(16, Math.floor(width * 0.03))}px; 
            font-family: sans-serif; 
            font-weight: bold; 
            text-shadow: 2px 2px 4px rgba(0,0,0,0.9); 
          }
        </style>
        <text x="20" y="${height - 60}" class="watermark">${dateText}</text>
        <text x="20" y="${height - 20}" class="watermark">${gpsData}</text>
      </svg>
    `;

    const processedFileName = `watermarked-${Date.now()}.jpg`;
    const processedFilePath = path.join(process.cwd(), 'uploads', processedFileName);

    await image
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        }
      ])
      .jpeg({ quality: 85 })
      .toFile(processedFilePath);

    console.log(`[WORKER] 🖼️ Marca de agua aplicada exitosamente.`);

    // 4. Actualizamos DB con la URL temporal y limpiamos el archivo crudo
    const finalStorageUrl = `/uploads/${processedFileName}`; 
    
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { fileUrl: finalStorageUrl }
    });

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    console.log(`[WORKER] ✅ Evidencia ${evidenceId} finalizada al 100%`);

  } catch (error) {
    console.error(`[WORKER] ❌ Error procesando evidencia ${evidenceId}:`, error);
  }
};