// src/services/receiver.service.ts
import { prisma } from '../db.js';
import { validateTransition } from '../utils/stateMachine.js';
import { sendConfirmationNotification, sendDisputeNotification } from './email.js';
import type { ShipmentStatus } from '@prisma/client';

async function validateReceiverAccess(shipmentId: string, trackingToken: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { receiverAction: true, company: true }
  });

  if (!shipment) {
    const err = new Error('Envío no encontrado');
    (err as any).statusCode = 404;
    throw err;
  }

  if (trackingToken !== shipment.trackingToken) {
    const err = new Error('No autorizado. Token de acceso inválido.');
    (err as any).statusCode = 401;
    throw err;
  }

  if (shipment.receiverAction) {
    const err = new Error('Este envío ya fue procesado por el receptor.');
    (err as any).statusCode = 409;
    throw err;
  }

  return shipment;
}

async function transitionStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  shipmentId: string,
  fromStatus: ShipmentStatus,
  toStatus: ShipmentStatus,
  actor: string
) {
  validateTransition(fromStatus, toStatus);

  await tx.shipment.update({
    where: { id: shipmentId },
    data: { status: toStatus }
  });

  await tx.auditLog.create({
    data: { shipmentId, fromStatus, toStatus, actor }
  });
}

export async function confirmDelivery(
  shipmentId: string,
  trackingToken: string,
  ipAddress?: string
) {
  const shipment = await validateReceiverAccess(shipmentId, trackingToken);

  await prisma.$transaction(async (tx) => {
    await transitionStatus(tx, shipmentId, shipment.status, 'CLOSED', 'receptor');
    await tx.receiverAction.create({
      data: { shipmentId, action: 'CONFIRMED', ipAddress: ipAddress ?? null }
    });
  });

  // companyId pasado para metering dentro de sendConfirmationNotification
  sendConfirmationNotification(
    shipment.company.email,
    shipment.trackingCode,
    shipment.destinatario,
    shipment.companyId
  );

  return { status: 'CLOSED' };
}

export async function initiateDispute(
  shipmentId: string,
  trackingToken: string,
  ipAddress?: string
) {
  const shipment = await validateReceiverAccess(shipmentId, trackingToken);

  if (shipment.status === 'CLOSED') {
    const err = new Error('No se puede disputar un envío ya cerrado.');
    (err as any).statusCode = 400;
    throw err;
  }

  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let visualToken = '';
  for (let i = 0; i < 4; i++) {
    visualToken += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  const expiresAt = new Date(Date.now() + 10 * 60_000);

  const disputeToken = await prisma.$transaction(async (tx) => {
    await transitionStatus(tx, shipmentId, shipment.status, 'DISPUTE', 'receptor');
    return tx.disputeToken.create({
      data: { shipmentId, visualToken, expiresAt }
    });
  });

  return {
    status: 'DISPUTE',
    dispute_token_id: disputeToken.id,
    visual_token: disputeToken.visualToken,
    expires_at: disputeToken.expiresAt,
    _ipAddress: ipAddress ?? null
  };
}

export async function linkDisputeEvidence(
  shipmentId: string,
  disputeTokenId: string,
  evidenceId: string,
  ipAddress?: string
) {
  const existing = await prisma.receiverAction.findUnique({ where: { shipmentId } });

  if (existing) {
    const err = new Error('Ya existe una acción registrada para este envío.');
    (err as any).statusCode = 409;
    throw err;
  }

  await prisma.receiverAction.create({
    data: { shipmentId, action: 'DISPUTED', disputeTokenId, evidenceId, ipAddress: ipAddress ?? null }
  });

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { company: true }
  });

  if (shipment) {
    sendDisputeNotification(
      shipment.company.email,
      shipment.trackingCode,
      shipment.destinatario,
      shipment.companyId
    );
  }
}