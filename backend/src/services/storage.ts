import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs';

// Inicializamos el cliente apuntando a Cloudflare R2
const s3Client = new S3Client({
  region: 'auto', // R2 siempre usa 'auto'
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'friese-evidences';

/**
 * Sube un archivo físico a Cloudflare R2
 */
export const uploadFileToStorage = async (filePath: string, destinationKey: string, mimetype: string) => {
  const fileStream = fs.createReadStream(filePath);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: destinationKey,
    Body: fileStream,
    ContentType: mimetype,
  });

  await s3Client.send(command);
  return destinationKey;
};

/**
 * Genera una URL temporal y segura para ver el archivo.
 * Por defecto expira en 1 hora (3600 segundos).
 */
export const generateSignedUrl = async (fileKey: string, expiresInSeconds = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};