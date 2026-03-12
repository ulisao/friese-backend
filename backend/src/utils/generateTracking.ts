import { prisma } from '../db';

const ALLOWED_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ALLOWED_NUMBERS = '23456789';

const getRandomString = (length: number, charset: string) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
};

export const generateUniqueTrackingCode = async (): Promise<string> => {
  let isUnique = false;
  let newCode = '';

  while (!isUnique) {
    const firstNumbers = getRandomString(3, ALLOWED_NUMBERS);
    const letters = getRandomString(3, ALLOWED_LETTERS);
    const lastNumbers = getRandomString(3, ALLOWED_NUMBERS);
    
    newCode = `${firstNumbers}-${letters}-${lastNumbers}`;

    const existingShipment = await prisma.shipment.findUnique({
      where: { trackingCode: newCode },
    });

    if (!existingShipment) {
      isUnique = true;
    }
  }

  return newCode;
};