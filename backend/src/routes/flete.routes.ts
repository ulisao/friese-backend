// src/routes/flete.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { sendOTP } from '../services/sms.js';
import crypto from 'node:crypto';
import { sendTrackingEmail } from '../services/email.js';

export async function fleteRoutes(fastify: FastifyInstance) {

  // POST /shipments/:id/verify-flete — Operario envía OTP al fletista
  fastify.post('/shipments/:id/verify-flete', {
    preHandler: fastify.authenticateDevice,
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
    const { companyId } = request.user;

    if (!companyId) {
      return reply.status(401).send({ error: 'Token de dispositivo inválido. Falta companyId.' });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return reply.status(404).send({ error: 'Envío no encontrado' });
    }

    if (shipment.companyId !== companyId) {
      request.log.warn(`[SECURITY] Device de company ${companyId} intentó operar sobre shipment de company ${shipment.companyId}`);
      return reply.status(403).send({ error: 'No tenés permiso para operar sobre este envío.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    await prisma.fleteValidation.create({
      data: {
        shipmentId,
        phoneSentTo: phone,
        otpCode: otpHash,
      }
    });

    try {
      await sendOTP(phone, otp);
      return reply.status(200).send({
        message: 'OTP generado y enviado por SMS exitosamente',
        phone_sent_to: phone
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // POST /shipments/:id/confirm-flete — Fletista ingresa el OTP
  // Sin autenticación JWT — el fletista no tiene cuenta, el acceso lo controla el OTP
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

    const latestValidation = await prisma.fleteValidation.findFirst({
      where: {
        shipmentId,
        validatedAt: null,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestValidation) {
      return reply.status(400).send({ error: 'No hay un código OTP pendiente para este envío.' });
    }

    const now = new Date();
    const diffMinutes = (now.getTime() - latestValidation.createdAt.getTime()) / 60000;

    if (diffMinutes > 10) {
      return reply.status(400).send({ error: 'El código OTP ha expirado. Solicitá uno nuevo.' });
    }

    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');

    if (hashedInput !== latestValidation.otpCode) {
      return reply.status(400).send({ error: 'El código OTP es incorrecto.' });
    }

    const transactionResults = await prisma.$transaction([
      prisma.fleteValidation.update({
        where: { id: latestValidation.id },
        data: {
          validatedAt: now,
          ipAddress: request.ip
        }
      }),
      prisma.shipment.update({
        where: { id: shipmentId },
        data: { status: 'IN_TRANSIT' },
        select: { receiverEmail: true, trackingCode: true, trackingToken: true }
      }),
      prisma.auditLog.create({
        data: {
          shipmentId,
          fromStatus: 'PENDING_FLETE',
          toStatus: 'IN_TRANSIT',
          actor: 'operario_en_planta'
        }
      })
    ]);

    const updatedShipment = transactionResults[1];

    sendTrackingEmail(
      updatedShipment.receiverEmail,
      updatedShipment.trackingCode,
      updatedShipment.trackingToken
    );

    return reply.status(200).send({
      message: 'Flete validado exitosamente. El envío ya está en tránsito y el email fue enviado.',
      status: 'IN_TRANSIT'
    });
  });
}