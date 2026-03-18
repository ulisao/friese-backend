// src/services/shipment.service.ts
import { prisma } from '../db.js'; // ✅ singleton — nunca new PrismaClient()
import { validateTransition } from '../utils/stateMachine.js';
import type { ShipmentStatus } from '@prisma/client';

export const updateShipmentStatus = async (
  shipmentId: string,
  newStatus: ShipmentStatus,
  actor: string
) => {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId }
  });

  if (!shipment) {
    throw new Error('Envío no encontrado');
  }

  validateTransition(shipment.status, newStatus);

  const result = await prisma.$transaction(async (tx) => {
    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: newStatus }
    });

    await tx.auditLog.create({
      data: {
        shipmentId: shipment.id,
        fromStatus: shipment.status,
        toStatus: newStatus,
        actor
      }
    });

    return updatedShipment;
  });

  return result;
};