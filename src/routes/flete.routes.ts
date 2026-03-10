import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { sendOTP } from '../services/sms';
import crypto from 'node:crypto';

export async function fleteRoutes(fastify: FastifyInstance) {
  
  fastify.post('/shipments/:id/verify-flete', {
    schema: {
      body: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { phone } = request.body as { phone: string };

    // 1. Verificamos que el envío exista
    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    // 2. Generamos un OTP numérico de 4 dígitos (ej: "4829")
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Hasheamos el OTP (igual que hicimos con el archivo) para no guardarlo en texto plano
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // 4. Guardamos el intento en la base de datos
    await prisma.fleteValidation.create({
      data: {
        shipmentId,
        phoneSentTo: phone,
        otpCode: otpHash,
      }
    });

    // 5. Enviamos el SMS con manejo de errores
    try {
      await sendOTP(phone, otp);
      
      // 6. Respondemos al cliente si todo salió bien
      return reply.status(200).send({
        message: 'OTP generado y enviado por SMS exitosamente',
        phone_sent_to: phone
      });
    } catch (error: any) {
      // Si Twilio falla (timeout o número inválido), devolvemos un 400 Bad Request
      return reply.status(400).send({ error: error.message });
    }
  });
}