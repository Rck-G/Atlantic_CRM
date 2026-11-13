# Contrato de integración neutral a proveedor

Este documento define el patrón de integración para sistemas externos. No representa una conexión activa ni sustituye la documentación del proveedor.

## Reglas

- Cada adaptador tiene nombre, versión, entorno, responsable y referencia segura a sus credenciales.
- Nunca se aceptan secretos en query strings ni se registran en logs.
- Autenticación recomendada: HMAC-SHA256 sobre cuerpo canónico + timestamp + nonce; tolerancia de reloj limitada; rechazo de firmas repetidas; rotación de claves.
- Cada mensaje debe tener `provider`, `externalId`, `eventType`, `occurredAt`, `schemaVersion` y `payload`.
- La idempotencia debe ser compuesta por proveedor + identificador externo + tipo de evento cuando aplique.
- La recepción HTTP confirma recepción durable, no procesamiento exitoso.
- El procesamiento se realiza asíncronamente con reintentos, backoff, dead-letter queue y replay autorizado.
- Los cambios de estado financieros deben ser reversibles y conciliables; no sobrescribir silenciosamente ventas ya contabilizadas.

## Sobre POS

El POS no está seleccionado. Por lo tanto:

1. No activar `/api/integrations/pos/sales` en producción ni compartir credenciales de ejemplo.
2. No presentar `Integration.lastStatus` como prueba de sincronización real.
3. Cuando se elija proveedor, revisar API oficial, sandbox, límites, autenticación, webhooks, identificadores, estados, devoluciones y conciliación.
4. Crear un adaptador independiente y probarlo con datos sintéticos del sandbox.
5. Activar producción únicamente tras aprobación de Finanzas, Operaciones y TI.

## Sobre el contrato canónico futuro

```json
{
  "provider": "identificador-del-proveedor",
  "schemaVersion": "1.0",
  "externalId": "id-unico-en-el-proveedor",
  "eventType": "sale.paid",
  "occurredAt": "2026-11-12T15:00:00.000Z",
  "payload": {
    "customerExternalId": "referencia-opcional",
    "currency": "PEN",
    "grossAmount": "100.00",
    "netAmount": "100.00",
    "status": "PAID"
  }
}
```

Los importes se representan como cadenas decimales en el contrato para evitar errores binarios de punto flotante. El adaptador valida y transforma al modelo canónico del CRM. Los nombres de eventos y campos son ilustrativos y deben versionarse antes de uso real.
