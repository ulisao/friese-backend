// src/db/db.ts
import Dexie, { type Table } from 'dexie';

// 1. Definimos la estructura de un envío guardado offline
export interface PendingShipment {
  id?: number; // El ++id de Dexie (autoincremental local)
  payload: {
    email: string;
    destinatario: string;
    lote: string;
    cantidad: number;
  };
  createdAt: number; // Timestamp para saber en qué orden sincronizarlos
}

// 2. Definimos la estructura de una foto sacada offline
export interface PendingEvidence {
  id?: number;
  shipmentId: string; // El ID del envío al que pertenece (UUID del backend)
  file: File | Blob;  // ¡La imagen cruda guardada en la base del navegador!
  hash: string;       // El hash SHA-256 para mantener la seguridad que armaste en el backend
  type: 'DEPARTURE' | 'COMPLAINT';
  metadataJson: any;
  createdAt: number;
}

export class FrieseDB extends Dexie {
  // Declaramos las tablas fuertemente tipadas
  pending_shipments!: Table<PendingShipment, number>;
  pending_evidence!: Table<PendingEvidence, number>;

  constructor() {
    super('FrieseOfflineDB');
    
    // IMPORTANTE: Cuando cambiás la estructura en Dexie, subís la versión.
    // Como en el ticket anterior hicimos la versión 1 de prueba, pasamos a la 2.
    // Solo se declaran las primary keys (++) y los campos por los que vas a hacer búsquedas (índices)
    this.version(2).stores({
      pending_shipments: '++id, createdAt',
      pending_evidence: '++id, shipmentId, type, createdAt'
    });
  }
}

export const db = new FrieseDB();