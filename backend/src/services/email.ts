// src/services/email.ts
import { Resend } from 'resend';
import { trackEmailSent } from './usage.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Friese Logística <onboarding@resend.dev>';

export async function sendTrackingEmail(
  to: string,
  trackingCode: string,
  trackingToken: string,
  companyId: string
) {
  const trackingLink = `${process.env.FRONTEND_URL}/tracking/${trackingCode}?token=${trackingToken}`;
  const subject = '📦 Tu envío está en camino - Friese';

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">¡Hola! Tu paquete ya está en tránsito. 🚚</h2>
          <p>Te avisamos que el flete ha validado la carga y tu envío ya salió de nuestra planta.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Código de seguimiento:</strong> ${trackingCode}</p>
          </div>
          <p>Podés seguir el estado de tu paquete en tiempo real haciendo clic en el siguiente enlace:</p>
          <a href="${trackingLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Rastrear mi envío</a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            Si el botón no funciona, ingresá con este token: <code>${trackingToken}</code>
          </p>
        </div>
      `
    });
    console.log(`[EMAIL] Tracking enviado a ${to} (ID: ${data.data?.id})`);
    trackEmailSent(companyId, to, subject);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló el envío del correo de tracking:', error);
  }
}

export async function sendConfirmationNotification(
  to: string,
  trackingCode: string,
  destinatario: string,
  companyId: string
) {
  const subject = `✅ Envío ${trackingCode} confirmado por el receptor`;

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">Entrega confirmada ✅</h2>
          <p><strong>${destinatario}</strong> confirmó la recepción conforme de su envío.</p>
          <div style="background-color: #f0faf0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0;"><strong>Código de envío:</strong> ${trackingCode}</p>
            <p style="margin: 8px 0 0;"><strong>Estado:</strong> Cerrado</p>
          </div>
          <p style="font-size: 13px; color: #666;">Podés ver el detalle completo y las evidencias desde tu panel de Friese.</p>
        </div>
      `
    });
    console.log(`[EMAIL] Confirmación enviada a empresa ${to} (ID: ${data.data?.id})`);
    trackEmailSent(companyId, to, subject);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló el envío de notificación de confirmación:', error);
  }
}

export async function sendDisputeNotification(
  to: string,
  trackingCode: string,
  destinatario: string,
  companyId: string
) {
  const subject = `⚠️ Reclamo recibido en envío ${trackingCode}`;

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">Reclamo recibido ⚠️</h2>
          <p><strong>${destinatario}</strong> reportó un problema con la recepción de su envío.</p>
          <div style="background-color: #fff8f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0;"><strong>Código de envío:</strong> ${trackingCode}</p>
            <p style="margin: 8px 0 0;"><strong>Estado:</strong> En disputa</p>
          </div>
          <p>El receptor adjuntó una foto como evidencia del reclamo. Podés verla desde tu panel de Friese.</p>
        </div>
      `
    });
    console.log(`[EMAIL] Notificación de disputa enviada a empresa ${to} (ID: ${data.data?.id})`);
    trackEmailSent(companyId, to, subject);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló el envío de notificación de disputa:', error);
  }
}