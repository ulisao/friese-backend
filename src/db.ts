// src/db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Creamos el pool de conexiones
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Opcional: configuraciones extra del pool
  max: 10, // Máximo de conexiones de este cliente
  idleTimeoutMillis: 30000,
});