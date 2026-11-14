# Cambios incorporados — 12/11/2026

## Backend
- Refuerzo de autenticación: rate limit específico para login/bootstrap y bootstrap atómico con aislamiento Serializable; opción para deshabilitar bootstrap en producción.
- Actividad de cliente idempotente mediante `Idempotency-Key`.
- Canje de beneficios protegido por actualizaciones condicionales dentro de transacción para evitar superar cupos por concurrencia.
- Tickets con paginación real y respuesta `{ data, page, limit, total, pages }`.
- Recalculo VIP optimizado con agregaciones agrupadas en lugar de consultas por cliente.
- Analítica ampliada con reservas, eventos y ventas POS pagadas.
- Ficha de cliente ampliada con reservas y ventas recientes.
- Nuevos modelos y endpoints para restaurantes, reservas, eventos, inscripciones, ventas e inbox de eventos de integración.
- Reservas y aforo de eventos validados en transacciones Serializable.
- Webhooks POS/eventos protegidos por secreto comparado en tiempo constante; ventas idempotentes y actividades de compra sincronizadas.
- OpenAPI ampliada con operaciones nuevas.

## Frontend
- Token de sesión en `sessionStorage` en lugar de `localStorage`.
- Compatibilidad con respuesta paginada de tickets.
- Nueva sección Operaciones para administrar restaurantes, crear reservas y publicar eventos según rol.
- Dashboard con métricas de reservas, eventos y ventas POS.

## Documentación
- README actualizado con instalación, rutas, estado, requisitos de integración y checklist cloud.
- Referencia de API operativa en `docs/API_OPERATIONS.md`.

## Verificación
- `node --check backend/src/index.js`: correcto.
- `node --check backend/prisma/seed.js`: correcto.
- JSON de los tres `package.json`: válido.
- Comprobación estructural de presencia de modelos Prisma: correcta.
- No se ejecutaron Prisma validate/generate, build Vite ni pruebas de integración: instalación npm agotó el tiempo disponible y Docker no está instalado en el entorno de construcción.

## Correcciones de revisión (12/11/2026)

- Se restringió el catálogo de eventos visible para cuentas CLIENT: solo reciben eventos publicados y cuya fecha de cierre no haya pasado. Los perfiles internos conservan la vista operativa completa.
- Los formularios de restaurantes, reservas y eventos ya no borran los datos ingresados cuando el servidor rechaza la operación; solo se reinician tras una respuesta satisfactoria.
- Se añadió manejo explícito de errores al convertir fechas locales de reservas/eventos, evitando que una fecha inválida rompa el flujo de envío.


## Registro público de clientes
- Se agregó pestaña de registro en la pantalla de acceso.
- Se agregó `POST /api/auth/register`, público y limitado a 5 solicitudes por hora.
- El servidor valida datos con Zod, crea Client + User en transacción y fija el rol CLIENT.
- Contraseñas con requisitos de complejidad y hash bcrypt cost 12.
- Documento y correo duplicados se rechazan; el consentimiento de marketing es opcional y desmarcado por defecto.
- Se registra la acción de alta propia en auditoría.
- Se documentó el flujo en `docs/REGISTRO_PUBLICO_CLIENTES.md`.
