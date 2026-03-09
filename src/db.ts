// src/db.ts
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

// 1. Cargamos las variables de entorno
dotenv.config();

// 2. Creamos el Pool de conexiones usando la librería pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 3. Creamos el adaptador para que Prisma entienda cómo usar pg
const adapter = new PrismaPg(pool);

// 4. Instanciamos Prisma pasándole el adaptador (¡El requisito obligatorio de la v7!)
export const prisma = new PrismaClient({ adapter });