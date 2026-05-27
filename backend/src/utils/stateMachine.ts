import { ShipmentStatus } from '@prisma/client';

const validTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING_EVIDENCE: ['PENDING_FLETE'],
  PENDING_FLETE: ['IN_TRANSIT'],
  IN_TRANSIT: ['DELIVERED', 'DISPUTE'],
  DELIVERED: ['CLOSED', 'DISPUTE'],
  CLOSED: [],
  DISPUTE: ['DISPUTE_RESOLVED'],
  DISPUTE_RESOLVED: ['CLOSED']
};

export class StateMachineError extends Error {
  statusCode: number;
  
  constructor(message: string) {
    super(message);
    this.name = 'StateMachineError';
    this.statusCode = 400; 
  }
}

export const validateTransition = (currentStatus: ShipmentStatus, nextStatus: ShipmentStatus): void => {
  const allowedNextStates = validTransitions[currentStatus];
  
  if (!allowedNextStates.includes(nextStatus)) {
    throw new StateMachineError(
      `Transición inválida: No se puede cambiar el envío de ${currentStatus} a ${nextStatus}`
    );
  }
};