// src/services/sms.ts
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'simulacro_sid';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'simulacro_token';
const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

const client = accountSid !== 'simulacro_sid' ? twilio(accountSid, authToken) : null;

export const sendOTP = async (phone: string, otp: string) => {
  if (!client) {
    console.info(`[SMS MOCK] 📱 Enviando OTP [ ${otp} ] al número ${phone}`);
    return true;
  }

  try {
    console.info(`[SMS] ⏳ Intentando conectar con Twilio para enviar a ${phone}...`);

    // 1. Preparamos la promesa de Twilio
    const smsPromise = client.messages.create({
      body: `Friese Seguridad: Tu código de retiro de carga es ${otp}. Válido por 10 minutos.`,
      from: twilioPhone,
      to: phone
    });

    // 2. Preparamos una promesa de Timeout (8 segundos)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_ERROR')), 8000)
    );

    // 3. Hacemos que compitan. Si Twilio tarda más de 8s, explota el timeout.
    const message = await Promise.race([smsPromise, timeoutPromise]) as any;

    // Si gana Twilio, logueamos el éxito con el ID de la transacción (SID)
    console.info(`[SMS] ✅ OTP enviado con éxito a ${phone}. Twilio SID: ${message.sid}`);
    return true;

  } catch (error: any) {
    // Manejo de Timeout
    if (error.message === 'TIMEOUT_ERROR') {
      console.error(`[SMS] ⏱️ Timeout: Twilio tardó demasiado en responder para el número ${phone}`);
      throw new Error('Timeout al contactar al proveedor de SMS. Reintente en unos minutos.');
    }

    // Manejo de errores específicos de la API de Twilio
    // 21211: Número inválido (ej: le faltan números, código de área mal)
    // 21614: No es un número móvil (es un teléfono fijo que no recibe SMS)
    if (error.code === 21211 || error.code === 21614) {
      console.error(`[SMS] ❌ Error de validación: Número inválido o no soporta SMS (${phone}).`);
      throw new Error('El número de teléfono proporcionado no es válido para recibir SMS.');
    }

    // Cualquier otro error raro (ej: te quedaste sin saldo en la cuenta)
    console.error(`[SMS] ❌ Error desconocido enviando a ${phone}:`, error);
    throw new Error('Error interno al enviar el mensaje de texto al fletista.');
  }
};