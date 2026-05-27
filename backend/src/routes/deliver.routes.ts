// src/routes/admin/deliver.routes.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { sendDeliveredNotification } from '../services/email.js';

export async function deliverRoutes(fastify: FastifyInstance) {

    // POST /admin/shipments/:id/deliver — Admin marca el envío como entregado
    // Protegido: solo el admin de la empresa propietaria del envío
    // Desde deliveredAt arranca el reloj de 72hs hábiles (post-MVP)
    fastify.post('/admin/shipments/:id/deliver', {
        preHandler: fastify.authenticate,
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string', format: 'uuid' }
                }
            }
        }
    }, async (request, reply) => {
        const { id: shipmentId } = request.params as { id: string };
        const { id: companyId } = request.user;

        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: { receiverLink: true }
        });

        if (!shipment) {
            return reply.status(404).send({ error: 'Envío no encontrado.' });
        }

        // Multi-tenancy: el admin solo puede operar sobre sus propios envíos
        if (shipment.companyId !== companyId) {
            request.log.warn(`[SECURITY] Company ${companyId} intentó marcar como entregado el shipment ${shipmentId} de otra empresa`);
            return reply.status(403).send({ error: 'No tenés permiso para operar sobre este envío.' });
        }

        if (shipment.status !== 'IN_TRANSIT') {
            return reply.status(400).send({
                error: `El envío no puede marcarse como entregado desde el estado ${shipment.status}.`
            });
        }

        // Crear o reutilizar el ReceiverLink
        // Si ya existe uno válido lo reutilizamos — el admin puede llamar
        // a este endpoint más de una vez sin romper nada
        let receiverToken: string;

        if (shipment.receiverLink && !shipment.receiverLink.invalidated) {
            receiverToken = shipment.receiverLink.token;
        } else {
            // Crear nuevo ReceiverLink — invalida el anterior si existía
            if (shipment.receiverLink) {
                await prisma.receiverLink.update({
                    where: { shipmentId },
                    data: { invalidated: true }
                });
            }

            const newLink = await prisma.receiverLink.create({
                data: { shipmentId }
            });
            receiverToken = newLink.token;
        }

        const now = new Date();

        await prisma.$transaction([
            prisma.shipment.update({
                where: { id: shipmentId },
                data: {
                    status: 'DELIVERED',
                    deliveredAt: now
                }
            }),
            prisma.auditLog.create({
                data: {
                    shipmentId,
                    fromStatus: 'IN_TRANSIT',
                    toStatus: 'DELIVERED',
                    actor: companyId
                }
            })
        ]);

        // Notificar al receptor — fire and forget
        sendDeliveredNotification(
            shipment.receiverEmail,
            shipment.trackingCode,
            receiverToken,
            shipment.destinatario,
            companyId
        );

        request.log.info(`[deliver] Shipment ${shipmentId} marcado como DELIVERED por company ${companyId}`);

        return reply.status(200).send({
            message: 'Envío marcado como entregado. El receptor fue notificado por email.',
            status: 'DELIVERED',
            delivered_at: now
        });
    });
}