# API de Operaciones e Integraciones

Base: `/api`. JSON UTF-8. Las rutas de operaciones requieren JWT y rol permitido, salvo webhooks que usan secreto de integración.

## Restaurantes

- `GET /restaurants`: catálogo activo.
- `POST /restaurants` (ADMIN): `{ "code":"REST-01", "name":"Restaurante principal", "location":"Salón norte", "capacity":80 }`.

## Reservas

- `GET /reservations?page=1&limit=20&restaurantId=...&status=CONFIRMED` (ADMIN/EMPLOYEE/MARKETING).
- `POST /reservations` (ADMIN/EMPLOYEE): `{ "restaurantId":"...", "guestName":"Invitado de prueba", "partySize":2, "startsAt":"2026-12-01T19:00:00.000Z", "endsAt":"2026-12-01T20:30:00.000Z", "source":"CRM" }`.
- `PATCH /reservations/:id/status`: `{ "status":"CONFIRMED" }`.

Se validan fechas futuras, capacidad individual del establecimiento y aforo agregado de las reservas activas que se solapan en el intervalo. La creación se ejecuta en transacción Serializable para reducir carreras. Antes de producción se recomienda añadir una restricción de exclusión PostgreSQL por rango temporal con `btree_gist`, y configurar política de duración/turnos por restaurante.

## Eventos

- `GET /events`: eventos con contador de inscripciones.
- `PATCH /events/:id` (MARKETING/ADMIN): actualiza datos, fechas, aforo o estado.
- `GET /events/:id/registrations` (ADMIN/EMPLOYEE/MARKETING): lista de asistentes.
- `POST /events` (MARKETING/ADMIN): `{ "code":"EVT-001", "name":"Evento de demostración", "startsAt":"2026-12-05T20:00:00.000Z", "endsAt":"2026-12-05T22:00:00.000Z", "capacity":100, "status":"PUBLISHED" }`.
- `POST /events/:id/register`: `{ "attendeeName":"Invitado de prueba", "attendeeEmail":"demo@example.test" }`.

La inscripción exige evento publicado, no vencido y aforo disponible. La verificación y creación usan transacción Serializable. Para producción se deben definir pagos, cancelaciones, lista de espera y reglas de reembolso.

## POS y bus de eventos

- `GET /sales?page=1&limit=20&status=PAID` (ADMIN/MARKETING): consulta paginada de ventas recibidas.

Configurar `INTEGRATION_WEBHOOK_SECRET` como secreto aleatorio de alta entropía. No reutilizarlo entre entornos ni proveedores. Enviar encabezado `X-Integration-Secret`.

`POST /integrations/pos/sales`:

```json
{
  "externalId": "POS-ORDER-2026-00001",
  "clientId": "id-cliente-interno-opcional",
  "source": "POS_PROVEEDOR",
  "currency": "PEN",
  "amount": 159.90,
  "status": "PAID",
  "soldAt": "2026-11-12T20:30:00.000Z"
}
```

La venta se hace upsert por `externalId`. Si está pagada y vinculada a un cliente, genera/actualiza una actividad `PURCHASE` idempotente; al cambiar a estado no pagado, retira esa actividad del cálculo de fidelización.

`POST /integrations/events` recibe `{ "source":"PROVEEDOR", "externalId":"evt-123", "eventType":"sale.created", "payload":{...} }` y crea un registro idempotente en `IntegrationEvent`. `GET /integrations/events` (ADMIN) permite inspeccionar eventos recibidos. La bandeja aún no incluye worker de procesamiento, reintentos automáticos ni DLQ.

## Idempotencia

`POST /clients/:id/activity` admite `Idempotency-Key` (máximo 120 caracteres). Repetir la misma clave y mismo cliente devuelve el registro existente; reutilizarla para otro cliente devuelve 409. POS usa clave interna `pos:<externalId>`.

## Reglas de negocio aún por parametrizar

- Umbrales, ponderaciones, ventanas y reglas de expiración VIP.
- Horarios de apertura, buffers, turnos, mesas y asignación de recursos por restaurante.
- Tarifas, pagos, depósitos, cancelación, no-show y política de reembolso.
- Aforo por tipo de entrada, cupos VIP, waitlist y aprobación de eventos.
- Catálogo de sistemas fuente, mapeo de identificadores y estrategia de conciliación.


## Registro público de clientes

`POST /api/auth/register` es público y crea en una sola transacción un `Client` y un `User` vinculado. El servidor fija el rol `CLIENT`; el cliente HTTP no puede solicitar roles internos. Valida nombres, apellidos, documento, correo, teléfono y contraseña con Zod. Aplica límite de 5 registros por hora. Responde 201 con token y perfil mínimo, 400 con errores de validación, 409 para documento/correo duplicado y 429 al superar el límite. Ver `REGISTRO_PUBLICO_CLIENTES.md` para el contrato completo y las limitaciones.
