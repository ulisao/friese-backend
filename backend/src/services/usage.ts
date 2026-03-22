// src/services/usage.service.ts
import { prisma } from '../db.js';
import type { UsageEventType } from '@prisma/client';

async function record(
  companyId: string,
  type: UsageEventType,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.usageEvent.create({
      data: { companyId, type, metadata: metadata ?? {} }
    });
  } catch (err) {
    console.error(`[METERING] Falló el registro de ${type} para company ${companyId}:`, err);
  }
}

export function trackShipmentCreated(companyId: string, shipmentId: string) {
  return record(companyId, 'SHIPMENT_CREATED', { shipmentId });
}

export function trackEmailSent(companyId: string, to: string, subject: string) {
  return record(companyId, 'EMAIL_SENT', { to, subject });
}

export function trackEvidenceUploaded(companyId: string, evidenceId: string, bytes: number) {
  return record(companyId, 'EVIDENCE_UPLOADED', { evidenceId, bytes });
}

// ---------------------------------------------------------------------------
// Queries de facturación
// ---------------------------------------------------------------------------

export type UsageSummary = {
  companyId:     string;
  companyName:   string;
  companyEmail:  string;
  period:        string;
  shipments:     number;
  emailsSent:    number;
  evidenceCount: number;
  storageBytes:  number;
};

export async function getCompanyUsage(companyId: string, period: string): Promise<UsageSummary> {
  const { start, end } = periodToDates(period);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error('Empresa no encontrada');

  const events = await prisma.usageEvent.findMany({
    where: { companyId, createdAt: { gte: start, lt: end } }
  });

  return buildSummary(company, period, events);
}

export async function getAllCompaniesUsage(period: string): Promise<UsageSummary[]> {
  const { start, end } = periodToDates(period);

  const companies = await prisma.company.findMany({
    include: {
      usageEvents: {
        where: { createdAt: { gte: start, lt: end } }
      }
    }
  });

  return companies.map((c) => buildSummary(c, period, c.usageEvents));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function periodToDates(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);
  return { start, end };
}

function buildSummary(
  company: { id: string; name: string; email: string },
  period: string,
  events: Array<{ type: UsageEventType; metadata: unknown }>
): UsageSummary {
  let storageBytes = 0;

  for (const ev of events) {
    if (ev.type === 'EVIDENCE_UPLOADED') {
      const meta = ev.metadata as { bytes?: number } | null;
      storageBytes += meta?.bytes ?? 0;
    }
  }

  return {
    companyId:     company.id,
    companyName:   company.name,
    companyEmail:  company.email,
    period,
    shipments:     events.filter((e) => e.type === 'SHIPMENT_CREATED').length,
    emailsSent:    events.filter((e) => e.type === 'EMAIL_SENT').length,
    evidenceCount: events.filter((e) => e.type === 'EVIDENCE_UPLOADED').length,
    storageBytes
  };
}