import { ShipmentStatus } from '@prisma/client';
import { validateTransition } from './stateMachine.js'; 
import { prisma } from '../db.js';


export const updateShipmentStatus = async (
  shipmentId: string,
  newStatus: ShipmentStatus,
  actor: string
) => {
  // 1. Buscamos el envío actual para saber su estado
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new Error('Envío no encontrado');
  }

  // 2. Validamos que la transición sea permitida (tira error 400 si es inválida)
  validateTransition(shipment.status, newStatus);

  // 3. Ejecutamos la transacción
  const result = await prisma.$transaction(async (tx) => {
    // A. Actualizamos el estado del envío
    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: newStatus },
    });

    // B. Dejamos el registro inmutable en el Audit Log
    await tx.auditLog.create({
      data: {
        shipmentId: shipment.id,
        fromStatus: shipment.status, 
        toStatus: newStatus,         
        actor: actor,                
      },
    });

    return updatedShipment;
  });

  return result;
};