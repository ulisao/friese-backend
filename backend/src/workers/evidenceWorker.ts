// src/workers/evidenceWorker.ts
import { prisma } from '../db.js';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { uploadFileToStorage } from '../services/storage.js';

export const processEvidenceImage = async (
  evidenceId: string,
  tempFilePath: string,
  mimetype: string
) => {
  try {
    console.log(`[WORKER] ⚙️ Iniciando procesamiento para evidencia: ${evidenceId}`);

    if (mimetype.startsWith('video/')) {
      console.log(`[WORKER] 🎥 Archivo de video detectado. Omitiendo marca de agua.`);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return;
    }

    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId }
    });

    if (!evidence) throw new Error('Evidencia no encontrada en DB');

    const dateText = new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Cordoba'
    });

    const metadata = (evidence.metadataJson as Record<string, any>) || {};
    const gpsData = metadata.gps ? `GPS: ${metadata.gps}` : 'GPS: No disponible';

    const image = sharp(tempFilePath);
    const imageMetadata = await image.metadata();
    const width = imageMetadata.width || 800;
    const height = imageMetadata.height || 600;

    // Tamaño reducido — 0.022 del ancho en lugar de 0.03
    const fontSize = Math.max(13, Math.floor(width * 0.022));
    // Grosor del stroke negro — proporcional al font size para que escale bien
    const strokeWidth = Math.max(2, Math.floor(fontSize * 0.18));

    // Técnica de doble render: primero stroke negro grueso, encima fill blanco.
    // text-shadow no funciona en SVG renderizado por Sharp — esta es la forma correcta.
    // El resultado es legible sobre cualquier fondo, oscuro o claro.
    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <style>
          .wm-outline {
            fill: none;
            stroke: black;
            stroke-width: ${strokeWidth}px;
            stroke-linejoin: round;
            font-size: ${fontSize}px;
            font-family: sans-serif;
            font-weight: bold;
          }
          .wm-fill {
            fill: white;
            stroke: none;
            font-size: ${fontSize}px;
            font-family: sans-serif;
            font-weight: bold;
          }
        </style>
        <!-- Línea 1: fecha — stroke negro -->
        <text x="20" y="${height - 40}" class="wm-outline">${dateText}</text>
        <!-- Línea 1: fecha — fill blanco encima -->
        <text x="20" y="${height - 40}" class="wm-fill">${dateText}</text>
        <!-- Línea 2: GPS — stroke negro -->
        <text x="20" y="${height - 14}" class="wm-outline">${gpsData}</text>
        <!-- Línea 2: GPS — fill blanco encima -->
        <text x="20" y="${height - 14}" class="wm-fill">${gpsData}</text>
      </svg>
    `;

    const originalBaseName = path.basename(tempFilePath, path.extname(tempFilePath));
    const processedFileName = `${originalBaseName}-wm.jpg`;
    const processedFilePath = path.join(process.cwd(), 'uploads', processedFileName);

    await image
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toFile(processedFilePath);

    console.log(`[WORKER] 🖼️ Marca de agua aplicada: ${processedFileName}`);

    // Nota: fileHash corresponde al archivo original pre-watermark — intencional.
    const finalStorageUrl = `/uploads/${processedFileName}`;

    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { fileUrl: finalStorageUrl }
    });

    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    console.log(`[WORKER] ✅ Evidencia ${evidenceId} finalizada.`);

  } catch (error) {
    console.error(`[WORKER] ❌ Error procesando evidencia ${evidenceId}:`, error);
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }
};