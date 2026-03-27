# Friese — Backlog Post-MVP

> Todo lo que se deja conscientemente para después de la primera versión en producción.
> Ordenado por prioridad estimada de aparición en conversaciones con clientes.

---

## Prioridad Alta — primeros 2 meses con clientes reales

### 72hs hábiles para confirmar o reclamar
- Cron job con `pg-boss` que corre cada hora
- Si el envío lleva más de 72hs hábiles en `DELIVERED` sin acción del receptor → cierre automático como `CLOSED`
- Recordatorio a las 24hs y 48hs via `sendReminderNotification` (ya implementado en `email.ts`)
- Definir tabla de feriados argentinos o usar librería de días hábiles

### Cola de workers con reintentos
- Reemplazar el fire-and-forget de `processEvidenceImage` por `pg-boss`
- Si el procesamiento de una foto falla, reintenta automáticamente
- Sin esto una foto puede quedar sin watermark y sin URL final en producción

### Superadmin dashboard UI
- Hoy solo existe el endpoint — falta la interfaz visual
- Tabla con consumo mensual por empresa
- Exportar CSV para facturación

### Contactos reutilizables
- Libreta de receptores y fletistas por empresa
- Al crear un envío, autocompletar desde contactos guardados
- Evitar tipear el mismo email/teléfono cada vez

---

## Prioridad Media — cuando el producto tenga tracción

### Múltiples fotos por item — límite de negocio
- Definir con clientes cuántas fotos máximo por item (¿5? ¿10?)
- Validación en `evidence.routes.ts` con un `COUNT` antes de aceptar el archivo
- Posiblemente configurable por empresa

### Plantillas de envío
- Guardar combinaciones de productos frecuentes como "kit"
- Al crear un envío, cargar una plantilla en lugar de llenar todo desde cero

### Exportar PDF del comprobante
- PDF con foto, hash, timestamp, datos del envío y firma del receptor
- Valor legal para las empresas

### Notificaciones internas
- Email al admin cuando hay una disputa (ya implementado) — agregar push notification o Slack webhook
- Dashboard con alertas de envíos sin acción del receptor

### Estados de timeout
- ¿Qué pasa si el receptor nunca abre el magic link?
- ¿Qué pasa si un envío queda en `IN_TRANSIT` por más de X días?

---

## Prioridad Baja — escala posterior

### Row Level Security en Supabase
- Segunda línea de defensa para multi-tenancy
- Hoy el aislamiento lo hace el código — RLS lo garantiza a nivel DB
- Activar antes de tener 10+ empresas con datos sensibles

### Magic link — mejoras
- Registro de si el receptor abrió el link (para soporte)
- Regenerar link desde el dashboard si el receptor dice que no le llegó
- Ya está la tabla `ReceiverLink` con campo `invalidated` preparada para esto

### Roles adicionales dentro de la empresa
- Supervisor (lectura de todos los envíos)
- Auditor (solo reportes, sin operaciones)

### API pública para integración con ERPs
- Documentación OpenAPI
- API keys por empresa
- Para clientes que quieran integrar Friese con su propio sistema

### Facturación automática
- Conectar `UsageEvent` con Stripe Billing (metered subscriptions)
- Hoy la facturación es manual vía superadmin dashboard

### Multi-región
- Feriados por provincia/país para el cálculo de 72hs hábiles
- Expansión fuera de Argentina

---

## Deuda técnica conocida

| Item | Impacto | Cuándo atacar |
|---|---|---|
| Archivos en `/uploads` locales — falta R2 | **Crítico** — se pierden al reiniciar | Antes de producción |
| Worker fire-and-forget sin reintentos | Alto | Antes de volumen real |
| Sin RLS en Supabase | Medio | Antes de 10+ empresas |
| `Shipment.metadata` sin esquema definido | Bajo | Cuando un cliente pida campos custom |
| JWT de empresa sin refresh token | Medio | Cuando aparezcan quejas de sesión expirada |

---

## Lo que falta para cerrar el MVP actual

1. Integrar Cloudflare R2 — reemplazar `/uploads` local
2. `POST /admin/shipments/:id/deliver` — el admin marca entregado
3. Actualizar `tracking.routes.ts` para usar `ReceiverLink` en lugar de `trackingToken`
4. Actualizar `receiver.service.ts` para validar contra `ReceiverLink`
5. Todo el frontend
