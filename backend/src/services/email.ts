// src/services/email.ts
import { Resend } from 'resend';
import { trackEmailSent } from './usage.service.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Friese Logística <onboarding@resend.dev>';

// ---------------------------------------------------------------------------
// Email al receptor — su envío está en camino
// ---------------------------------------------------------------------------
export async function sendTrackingEmail(
  to: string,
  trackingCode: string,
  receiverToken: string,
  companyId: string
) {
  const link = `${process.env.FRONTEND_URL}/tracking/${trackingCode}?token=${receiverToken}`;
  const subject = '📦 Tu envío está en camino - Friese';

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">¡Hola! Tu paquete ya está en tránsito. 🚚</h2>
          <p>Te avisamos que tu envío ya salió de la planta.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Código de seguimiento:</strong> ${trackingCode}</p>
          </div>
          <p>Cuando recibas el paquete, usá el siguiente link para confirmarlo o reportar un problema:</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Ver mi envío</a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">Si el botón no funciona, ingresá con este token: <code>${receiverToken}</code></p>
        </div>
      `
    });
    trackEmailSent(companyId, to, subject);
    console.log(`[EMAIL] Tracking enviado a ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló sendTrackingEmail:', error);
  }
}

// ---------------------------------------------------------------------------
// Email al receptor — el admin marcó el pedido como entregado
// Desde que el receptor presione "Recibido" en este link corren las 72hs
// ---------------------------------------------------------------------------
export async function sendDeliveredNotification(
  to: string,
  trackingCode: string,
  receiverToken: string,
  destinatario: string,
  companyId: string
) {
  const link = `${process.env.FRONTEND_URL}/tracking/${trackingCode}?token=${receiverToken}`;
  const subject = `📬 Tu pedido fue entregado - Friese`;

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">¡Hola, ${destinatario}!</h2>
          <p>Tu pedido fue marcado como entregado. Tenés <strong>72 horas hábiles desde ahora</strong> para confirmar la recepción o presentar un reclamo.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Código de seguimiento:</strong> ${trackingCode}</p>
          </div>
          <p>Si no tomás ninguna acción en ese plazo, el envío se considerará <strong>conforme automáticamente</strong>.</p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Revisar mi envío</a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">Si el botón no funciona, ingresá con este token: <code>${receiverToken}</code></p>
        </div>
      `
    });
    trackEmailSent(companyId, to, subject);
    console.log(`[EMAIL] Delivered notification enviado a ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló sendDeliveredNotification:', error);
  }
}

// ---------------------------------------------------------------------------
// Recordatorio al receptor — sin acción tras X horas desde acknowledgedAt
// ---------------------------------------------------------------------------
export async function sendReminderNotification(
  to: string,
  trackingCode: string,
  receiverToken: string,
  destinatario: string,
  companyId: string,
  hoursRemaining: number
) {
  const link = `${process.env.FRONTEND_URL}/tracking/${trackingCode}?token=${receiverToken}`;
  const subject = `⏰ Recordatorio: tenés ${hoursRemaining}hs para revisar tu envío - Friese`;

  try {
    const data = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #000;">Hola, ${destinatario} 👋</h2>
          <p>Te recordamos que tenés <strong>${hoursRemaining} horas hábiles</strong> para confirmar la recepción de tu pedido o presentar un reclamo.</p>
          <div style="background-color: #fff8f0; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 0;"><strong>Código de seguimiento:</strong> ${trackingCode}</p>
            <p style="margin: 8px 0 0;">Si no tomás ninguna acción en este plazo, el envío se considerará <strong>conforme automáticamente</strong>.</p>
          </div>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Revisar mi envío</a>
        </div>
      `
    });
    trackEmailSent(companyId, to, subject);
    console.log(`[EMAIL] Reminder (${hoursRemaining}hs) enviado a ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló sendReminderNotification:', error);
  }
}

// ---------------------------------------------------------------------------
// Email a la empresa — receptor dio conformidad
// ---------------------------------------------------------------------------
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
          <p style="font-size: 13px; color: #666;">Podés ver el detalle completo desde tu panel de Friese.</p>
        </div>
      `
    });
    trackEmailSent(companyId, to, subject);
    console.log(`[EMAIL] Confirmación enviada a empresa ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló sendConfirmationNotification:', error);
  }
}

// ---------------------------------------------------------------------------
// Email a la empresa — receptor levantó una queja
// ---------------------------------------------------------------------------
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
          <p>El receptor adjuntó una foto como evidencia. Podés verla desde tu panel de Friese.</p>
        </div>
      `
    });
    trackEmailSent(companyId, to, subject);
    console.log(`[EMAIL ERROR] Disputa enviada a empresa ${to} (ID: ${data.data?.id})`);
    return data;
  } catch (error) {
    console.error('[EMAIL ERROR] Falló sendDisputeNotification:', error);
  }
}