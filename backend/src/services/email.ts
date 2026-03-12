// src/services/email.ts
import { Resend } from 'resend';

// Inicializamos el cliente con la variable de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendTrackingEmail(to: string, trackingCode: string, trackingToken: string) {
  // En producción esto apuntaría a tu frontend en Vercel/Netlify
  const trackingLink = `http://localhost:3000/tracking/${trackingCode}?token=${trackingToken}`;

  try {
    const data = await resend.emails.send({
      from: 'Friese Logística <onboarding@resend.dev>', // Resend te da este mail temporal para pruebas
      to: [to],
      subject: '📦 Tu envío está en camino - Friese',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">¡Hola! Tu paquete ya está en tránsito. 🚚</h2>
          <p>Te avisamos que el flete ha validado la carga y tu envío ya salió de nuestra planta.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Código de seguimiento:</strong> ${trackingCode}</p>
          </div>
          <p>Podés seguir el estado de tu paquete en tiempo real y ver las evidencias haciendo clic en el siguiente enlace seguro:</p>
          <a href="${trackingLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Rastrear mi envío</a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Si el botón no funciona, ingresá a nuestro portal con tu código y este token de seguridad temporal: <code>${trackingToken}</code>
          </p>
        </div>
      `
    });
    console.log(`[EMAIL] Correo de tracking enviado a ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló el envío del correo:', error);
    // No hacemos throw error porque no queremos que el cliente vea un error 500
    // si falla el mail, el paquete ya está en tránsito igual.
  }
}