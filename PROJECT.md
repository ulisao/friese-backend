# Friese — Project Context for AI Coding Agent

> Este archivo es el contexto maestro del proyecto. Léelo completo antes de cualquier tarea.
> Última actualización: Marzo 2026

---

## 1. ¿Qué es Friese?

Friese es una plataforma SaaS B2B de **trazabilidad logística** orientada a fábricas y PyMEs latinoamericanas.

Su propuesta de valor central: reemplazar el proceso manual y sin respaldo de las entregas de mercadería por un sistema digital que genera **evidencia fotográfica certificada** y una **cadena de custodia criptográfica** en cada traspaso de un envío.

El pain point que resuelve: cuando una PyME entrega mercadería a un transportista, no existe registro confiable de *en qué estado se entregó, quién la recibió y cuándo*. Friese cierra esa brecha.

**Mercado objetivo inicial:** PyMEs industriales y comerciales de Marcos Juárez, Córdoba, Argentina. Expansión posterior al resto de la región.

---

## 2. Stack Tecnológico

### Frontend
- **Framework:** React con Vite
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Componentes:** [COMPLETAR — ej: shadcn/ui, Radix, etc.]
- **Estado global / data fetching:** [COMPLETAR — ej: Zustand, React Query, etc.]
- **Routing:** [COMPLETAR — ej: React Router, TanStack Router]

### Backend
- **Runtime:** Node.js
- **Framework HTTP:** Fastify
- **ORM:** Prisma Client
- **Base de datos:** PostgreSQL vía Supabase
- **Connection pooling:** PgBouncer (Supabase managed) — usar `?pgbouncer=true` en `DATABASE_URL` para Prisma en producción, y `DIRECT_URL` sin PgBouncer para migraciones

### Storage
- **Fotos de evidencia:** Cloudflare R2
  - Operaciones de clase A (escritura) y clase B (lectura) — considerar para costos
  - Upload directo desde el cliente con presigned URLs — nunca pasar el archivo por el servidor Fastify

### Autenticación
El sistema tiene **cuatro tipos de actores** con flujos de autenticación distintos:

#### 1. Empresa / Admin (login tradicional)
- Registro estándar de cuenta para la empresa
- Login con email + contraseña → JWT de corta duración
- Acceso al dashboard completo (envíos, operarios, reportes)
- Desde el dashboard puede dar de alta operarios

#### 2. Operario (QR de alta)
- El admin genera un QR desde el dashboard para registrar un nuevo operario
- El operario escanea el QR con su dispositivo → queda autenticado con un **JWT de larga duración** (sesión persistente en el dispositivo)
- El operario usa la app para registrar envíos — no necesita hacer login cada vez

#### 3. Receptor (Magic Link por email)
- Cuando el envío cambia de estado, el receptor recibe una **notificación por email con un Magic Link**
- Ese link lo lleva a la pantalla de seguimiento de su envío específico
- Desde esa pantalla puede dar conformidad o levantar una queja (con imagen adjunta)
- El Magic Link es de un solo uso y tiene TTL limitado
- El receptor **no tiene cuenta** en el sistema — accede únicamente por este link

#### 4. Fletista / Transportista (confirmación por SMS)
- Antes de que el transportista salga con la mercadería, recibe un **SMS con un código**
- Ingresa ese código en la app para confirmar que recibió la mercadería
- Este paso es requisito para que el envío avance de estado
- El fletista tampoco tiene cuenta en el sistema

### Infraestructura y Deploy
- **Hosting:** [COMPLETAR — ej: Railway, Render, Fly.io para backend; Vercel/Netlify para frontend]
- **CI/CD:** [COMPLETAR]
- **Variables de entorno críticas:**
  - `DATABASE_URL` — con `?pgbouncer=true&connection_limit=1`
  - `DIRECT_URL` — URL directa sin PgBouncer (para migraciones de Prisma)
  - `JWT_SECRET` — firma de tokens
  - `CLOUDFLARE_R2_*` — credenciales y bucket de storage
  - `SMS_PROVIDER_*` — credenciales del proveedor de SMS [COMPLETAR — ej: Twilio, Vonage]
  - Credenciales de email provider para Magic Links y notificaciones
  - [COMPLETAR resto]

---

## 3. Arquitectura de la Aplicación

### Repositorio
- **Monorepo o repos separados:** [COMPLETAR]
- **Frontend:** React + Vite, servido de forma estática o con CDN
- **Backend:** Fastify como API REST, corre como proceso Node.js independiente

### Estructura de carpetas

#### Backend (Fastify)
```
/
├── src/
│   ├── routes/
│   │   ├── auth/           # Login empresa, QR operario, magic link, SMS code
│   │   ├── shipments/      # CRUD de envíos
│   │   ├── evidence/       # Registro de evidencia fotográfica
│   │   ├── operators/      # Alta y gestión de operarios
│   │   └── [COMPLETAR]
│   ├── plugins/            # Plugins de Fastify (JWT, CORS, multipart, etc.)
│   ├── services/           # Lógica de negocio desacoplada de las rutas
│   ├── lib/
│   │   ├── prisma.ts       # Singleton de Prisma Client
│   │   ├── r2.ts           # Cliente de Cloudflare R2
│   │   ├── mailer.ts       # Envío de emails (magic link, notificaciones)
│   │   └── sms.ts          # Envío de SMS (confirmación fletista)
│   └── index.ts            # Entry point de Fastify
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── [COMPLETAR]
```

#### Frontend (React + Vite)
```
/
├── src/
│   ├── pages/ (o views/)
│   │   ├── Dashboard/      # Panel admin/empresa
│   │   ├── ShipmentForm/   # Formulario de nuevo envío (operario)
│   │   ├── Tracking/       # Vista de seguimiento (receptor, vía magic link)
│   │   └── [COMPLETAR]
│   ├── components/         # Componentes reutilizables
│   ├── hooks/              # Custom hooks
│   ├── services/ (o api/)  # Funciones de llamada a la API
│   └── [COMPLETAR]
└── [COMPLETAR]
```

> **[COMPLETAR]:** Reemplazar con la estructura real del repo (`tree -L 3`).

### Singleton de Prisma (patrón obligatorio en el backend)

```ts
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Nunca instanciar `new PrismaClient()` fuera de este singleton.**

---

## 4. Modelo de Dominio y Entidades Clave

### Entidades principales

#### `Organization`
- La empresa/PyME cliente de Friese
- Multi-tenant: cada organización ve solo sus propios datos
- Tiene uno o más admins y múltiples operarios
- [COMPLETAR — estrategia de tenant isolation]

#### `User`
- Representa a un miembro de una `Organization`
- Roles: `ADMIN`, `OPERATOR` [COMPLETAR si hay más]
- **Admin:** login con email + contraseña → JWT corto
- **Operator:** dado de alta por QR → JWT largo, sin contraseña

#### `Shipment` (Envío)
Representa un movimiento de mercadería de una empresa hacia un receptor.
- Tiene datos de la mercadería, fletista y receptor
- Pasa por estados: [COMPLETAR — ej: `PENDING → AWAITING_CARRIER_CONFIRMATION → IN_TRANSIT → DELIVERED → CONFIRMED / DISPUTED`]
- Cada cambio de estado dispara notificaciones a los actores correspondientes

#### `EvidenceRecord` (Registro de Evidencia)
El corazón del producto. Documenta el estado de la mercadería al momento del despacho.
- Vinculado a un `Shipment`
- Contiene: timestamp, foto(s) almacenadas en R2, hash SHA-256 de cada foto
- Es **inmutable** una vez creado — no se edita ni se elimina nunca

#### `CarrierConfirmation`
- Registro de la confirmación del fletista por SMS
- Contiene: código enviado, timestamp de confirmación, número de teléfono
- Requisito para avanzar el `Shipment` de estado

#### `ReceiverAction`
- Acción del receptor tras recibir el Magic Link
- Puede ser: `CONFIRMED` (conforme) o `DISPUTED` (queja con imagen adjunta)
- Dispara notificación a la empresa

### Reglas de negocio críticas

1. **Un `EvidenceRecord` no se puede modificar ni eliminar.** Solo INSERT, nunca UPDATE/DELETE.
2. **La foto es obligatoria** en el registro del envío — no se puede crear un `EvidenceRecord` sin al menos una foto subida a R2.
3. **El fletista debe confirmar por SMS** antes de que el envío avance a `IN_TRANSIT`.
4. **El receptor actúa únicamente a través del Magic Link** — no tiene cuenta ni contraseña en el sistema.
5. **Multi-tenancy estricto:** toda query a la DB debe filtrar por `organizationId`. Nunca exponer datos entre organizaciones.
6. [COMPLETAR con más reglas si existen]

---

## 5. Flujo Principal (Happy Path)

```
1. La empresa crea su cuenta (admin)
2. Admin genera QR desde el dashboard → operario lo escanea y queda registrado

Por cada envío:
3. El operario abre la app, llena el formulario con datos de la mercadería,
   fletista y receptor, y sube la foto
   → la foto se hashea (SHA-256) y se crea el EvidenceRecord en la DB
4. El fletista recibe un SMS con un código de confirmación
5. El fletista ingresa el código en la app → confirma recepción de mercadería
   → el Shipment avanza de estado
6. El receptor recibe un email de notificación con un Magic Link
7. El receptor entra al link → pantalla de seguimiento de su envío específico
8. El receptor elige:
   a. Dar conformidad → la empresa recibe notificación de OK
   b. Levantar una queja adjuntando una imagen → la empresa recibe notificación de disputa
```

---

## 6. Convenciones y Reglas de Código

### General
- **Lenguaje:** TypeScript estricto en frontend y backend. No usar `any` salvo caso excepcional justificado con comentario.
- **Async:** siempre `async/await`, nunca `.then().catch()` sin motivo.
- **Errores:** capturar en `try/catch`. En Fastify, responder con `reply.code(XXX).send({ error: '...' })` o el error handler global del servidor.
- **Imports:** paths absolutos con alias configurado (`@/` o similar en `tsconfig.json` / `vite.config.ts`).

### Base de Datos
- **Solo Prisma Client** para acceso a DB. No usar queries SQL raw salvo necesidad extrema y justificada.
- Toda migración se hace con `prisma migrate dev` en local y `prisma migrate deploy` en producción.
- Al agregar campos al schema, considerar valores default para migraciones sobre datos existentes.
- **PgBouncer:** Prisma usa `DATABASE_URL` con `?pgbouncer=true`. Las migraciones usan `DIRECT_URL`.

### Fastify (Backend)
- Registrar rutas como plugins de Fastify para mantener modularidad.
- La lógica de negocio va en `services/` — los handlers de ruta son solo entrada/salida (parsing, validación, respuesta).
- Validar los payloads de entrada con JSON Schema de Fastify o con Zod + plugin de integración.
- Autenticación con `@fastify/jwt` — verificar el token en el hook `onRequest` o `preHandler` de las rutas protegidas.
- Para rutas del receptor (magic link), validar el token específico de ese link, no el JWT de empresa/operario.

### React + Vite (Frontend)
- Componentes funcionales con hooks — sin class components.
- Separar lógica de negocio y llamadas a API en hooks custom o en `services/` — no hacer fetch directamente dentro de los componentes.
- [COMPLETAR — convenciones de estado global, React Query, etc.]

### Cloudflare R2
- Para subir fotos: generar una **presigned URL** desde el backend y hacer el upload directo desde el cliente.
- **Nunca** hacer pasar el archivo por el servidor Fastify.
- Hashear la foto **antes del upload** en el cliente (SHA-256) y enviar el hash al backend para guardarlo en el `EvidenceRecord`.
- No regenerar presigned URLs innecesariamente — las escrituras (clase A) cuestan más que las lecturas (clase B).

### Autenticación — Resumen de tokens

| Actor | Mecanismo | Duración | Notas |
|---|---|---|---|
| Admin / empresa | Email + contraseña → JWT | Corta (ej: 1h + refresh) | Login estándar |
| Operario | QR de alta → JWT | Larga (ej: 30 días) | Sesión persistente en dispositivo |
| Fletista | Código por SMS | Un solo uso, TTL corto | Solo para confirmar recepción |
| Receptor | Magic Link por email | Un solo uso, TTL corto | Acceso a tracking de su envío |

---

## 7. Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://..."   # Sin PgBouncer, para migraciones

# Auth
JWT_SECRET=""
JWT_EXPIRES_IN="1h"
JWT_OPERATOR_EXPIRES_IN="30d"

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=""
CLOUDFLARE_R2_ACCESS_KEY_ID=""
CLOUDFLARE_R2_SECRET_ACCESS_KEY=""
CLOUDFLARE_R2_BUCKET_NAME=""
CLOUDFLARE_R2_PUBLIC_URL=""

# Email (Magic Links y notificaciones)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
# [O credenciales de proveedor transaccional: Resend, SendGrid, etc.]

# SMS (confirmación fletista)
SMS_PROVIDER_API_KEY=""
# [COMPLETAR según proveedor: Twilio, Vonage, etc.]

# App
FRONTEND_URL=""
PORT=3000
NODE_ENV="production"
```

---

## 8. Errores Conocidos y Soluciones

| Problema | Causa | Solución |
|---|---|---|
| `PrismaClientInitializationError` en producción | PgBouncer incompatible con connection pooling de Prisma | Agregar `?pgbouncer=true&connection_limit=1` a `DATABASE_URL` |
| Upload de fotos lento / timeout | Archivos pasando por el servidor Fastify | Usar presigned URLs de R2 para upload directo desde el cliente |
| [COMPLETAR con otros errores encontrados] | | |

---

## 9. Instrucciones para el Agente

- **Antes de tocar cualquier archivo**, entender qué entidad del dominio está involucrada y si la operación respeta las reglas de negocio (inmutabilidad de `EvidenceRecord`, multi-tenancy, flujo de estados del `Shipment`).
- **No inventar schemas de DB** — revisar `prisma/schema.prisma` antes de asumir nombres de campos o relaciones.
- **No agregar dependencias** sin mencionarlo explícitamente. Preferir las ya instaladas.
- **No usar `any` en TypeScript** — inferir tipos desde los generados por Prisma o definirlos explícitamente.
- **Siempre filtrar por `organizationId`** en queries a la DB.
- La lógica de negocio va en `services/` — los handlers de Fastify son solo entrada/salida.
- Respetar los cuatro flujos de autenticación (admin, operario, fletista, receptor) — no mezclarlos ni simplificarlos.
- En caso de duda sobre una decisión de arquitectura, **preguntar antes de implementar**.
