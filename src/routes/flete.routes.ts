//src/routes/flete.routes
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

fastify.post('/shipments/:id/confirm-flete', {
    schema: {
      body: {
        type: 'object',
        required: ['otp'],
        properties: {
          otp: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id: shipmentId } = request.params as { id: string };
    const { otp } = request.body as { otp: string };

    // 1. Buscar el ÚLTIMO intento de OTP generado para este envío que no haya sido usado
    const latestValidation = await prisma.fleteValidation.findFirst({
      where: {
        shipmentId,
        validatedAt: null, 
      },
      orderBy: {
        createdAt: 'desc' // Traemos el más reciente por si pidió varios SMS
      }
    });

    if (!latestValidation) {
      return reply.status(400).send({ error: 'No hay un código OTP pendiente para este envío.' });
    }

    // 2. Verificar expiración (10 minutos de vida útil)
    const now = new Date();
    const diffMinutes = (now.getTime() - latestValidation.createdAt.getTime()) / 60000;
    
    if (diffMinutes > 10) {
      return reply.status(400).send({ error: 'El código OTP ha expirado. Solicite uno nuevo.' });
    }

    // 3. Hashear el código ingresado por el usuario y compararlo con la base de datos
    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    
    if (hashedInput !== latestValidation.otpCode) {
      // Retornamos 400 sin cambiar el estado, tal como pide el ticket
      return reply.status(400).send({ error: 'El código OTP es incorrecto.' });
    }

    // 4. ¡Match exitoso! Ejecutamos todo junto en una Transacción
    await prisma.$transaction([
      // A) Marcamos el OTP como usado
      prisma.fleteValidation.update({
        where: { id: latestValidation.id },
        data: { 
          validatedAt: now,
          ipAddress: request.ip // Guardamos la IP por seguridad
        }
      }),
      
      // B) Pasamos el envío a En Tránsito
      prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: 'IN_TRANSIT' }
      }),

      // C) Dejamos registro en la auditoría
      prisma.auditLog.create({
        data: {
          shipmentId,
          fromStatus: 'PENDING_FLETE',
          toStatus: 'IN_TRANSIT',
          actor: 'operario_en_planta' // TODO: Leer del token JWT cuando agregues Auth
        }
      })
    ]);

    // 5. Devolvemos el éxito al frontend
    return reply.status(200).send({
      message: 'Flete validado exitosamente. El envío ya está en tránsito.',
      status: 'IN_TRANSIT'
    });
  });
}