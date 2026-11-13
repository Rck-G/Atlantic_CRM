# Atlantic City CRM

CRM web modular para clientes, fidelización, campañas, beneficios, HelpDesk, reservas, restaurantes, eventos, ventas/POS e integración de sistemas.

**Stack:** React 18 + Vite, Node.js 20 + Express, PostgreSQL 16 + Prisma. API REST/JSON documentada en Swagger.

> **Estado de entrega:** código ampliado y preparado para integración. La revisión y validación ejecutada en este entorno es estática (`node --check` del backend). No se pudo instalar dependencias ni levantar PostgreSQL/Docker en este entorno, por lo que no se afirma que los flujos hayan superado pruebas de integración. Los proveedores reales de POS, membresías, reservas, eventos y marketing no fueron identificados; por ello los endpoints de dominio y el webhook POS quedan listos para configuración, pero no hay conectividad externa activa. Las reglas VIP y políticas operativas son parámetros de negocio pendientes de aprobación.

## Evolución integral

El alcance aprobado es integral: Gerencia, Marketing, Operaciones, Atención al Cliente y clientes finales. El proveedor POS aún no está definido, por lo que no se considera activa ninguna integración POS productiva. La arquitectura futura debe ser neutral a proveedor.

Documentos de planificación:
- `docs/PLAN_EVOLUCION_CRM_2_0.md`: fases, entregables, criterios de salida, permisos y modelo de datos objetivo.
- `docs/BACKLOG_PRIORIZADO_2_0.md`: backlog priorizado y primer sprint recomendado.
- `docs/CONTRATO_INTEGRACIONES_NEUTRAL.md`: patrón para integraciones futuras, incluido POS cuando se seleccione proveedor.

Estos documentos son el plan de trabajo; no significan que las funcionalidades futuras ya estén implementadas.

## Módulos y capacidades

1. **Clientes/CRM:** alta, consulta, edición, ficha, historial, búsqueda y paginación; unicidad de DNI.
2. **Fidelización/VIP:** score y niveles de referencia, vista previa `dryRun`, campañas segmentadas y audiencia filtrada por consentimiento.
3. **Beneficios:** catálogo, asignación con elegibilidad, vigencias y canje transaccional con control de concurrencia y cupo.
4. **Marketing:** campañas, segmentos VIP y consentimiento de marketing.
5. **HelpDesk:** tickets, estados, prioridades, historial y listado paginado.
6. **Restaurantes/reservas:** catálogo de restaurantes, creación y consulta de reservas, validación de horarios superpuestos, estados y vínculo opcional con cliente.
7. **Eventos:** catálogo, publicación, aforo e inscripción de asistentes.
8. **Ventas/POS:** recepción autenticada de ventas, persistencia decimal, actualización idempotente por ID externo y registro de actividad de compra para clientes vinculados.
9. **Administración:** usuarios, roles existentes, auditoría, inventario de integraciones y bandeja de eventos de integración.
10. **Seguridad base:** Helmet, CORS allowlist, rate limiting global y de login/bootstrap, contraseñas con bcrypt, JWT de 8 horas, validación Zod y token frontend en `sessionStorage` en vez de `localStorage`.

## Requisitos

- Docker Desktop con Docker Compose, o Node.js 20+ y PostgreSQL 16.
- Para producción: HTTPS, secretos administrados, PostgreSQL administrado, copias de seguridad, monitoreo y revisión de seguridad.

## Inicio local con Docker

1. Copia `.env.example` como `.env`.
2. Genera valores aleatorios propios para `JWT_SECRET` e `INTEGRATION_WEBHOOK_SECRET`. Cambia `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres). No publiques `.env`.
3. `ALLOW_BOOTSTRAP_ADMIN=true` solo durante el primer alta de administrador. Después cámbialo a `false` y reinicia la API.
4. Ejecuta `docker compose up --build -d`.
5. Ejecuta `docker compose exec api npm run db:seed` para crear el administrador configurado y datos de demostración ficticios.
6. Accede a `http://localhost:5173`; API `http://localhost:4000/api`; Swagger `http://localhost:4000/api/docs`.

El contenedor de desarrollo sincroniza el esquema con `prisma db push`. **No uses `db push` como estrategia de cambios en producción**: antes de desplegar se debe generar y revisar el baseline/migraciones Prisma, aplicar `prisma migrate deploy` y ensayar restauración de backups.

## Ejecución manual

En `backend/`: copia `backend/.env.example` a `.env`, configura `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `INTEGRATION_WEBHOOK_SECRET`; ejecuta `npm install`, `npm run db:generate`, `npm run db:push`, `npm run db:seed`, `npm run dev`.

En `frontend/`: ejecuta `npm install` y `npm run dev`. Ajusta `VITE_API_URL` si la API no usa `http://localhost:4000/api`.

## API principal

Todas las rutas protegidas usan `Authorization: Bearer <JWT>` salvo el webhook POS, que usa `X-Integration-Secret`.

| Dominio | Rutas |
|---|---|
| Auth | `POST /api/auth/login`, `GET/PATCH /api/auth/me`, `POST /api/auth/bootstrap-admin` (solo bootstrap; deshabilitar tras el primer admin) |
| Clientes | `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`, `POST /api/clients/:id/activity` (acepta `Idempotency-Key`) |
| VIP | `POST /api/vip/recalculate` (`clientId`, `dryRun`) |
| Campañas | `GET/POST /api/campaigns`, `GET /api/campaigns/:id/audience`, `POST /api/campaigns/:id/assign-benefits` |
| Beneficios | `GET/POST /api/benefits`, `POST /api/benefits/:id/assign`, `POST /api/benefits/:id/redeem` |
| HelpDesk | `GET/POST /api/tickets` (paginado), `PATCH /api/tickets/:id` |
| Restaurantes | `GET/POST /api/restaurants` |
| Reservas | `GET/POST /api/reservations`, `PATCH /api/reservations/:id/status` |
| Eventos | `GET/POST /api/events`, `POST /api/events/:id/register` |
| POS | `POST /api/integrations/pos/sales` (webhook autenticado, idempotente por `externalId`) |
| Integraciones | `GET/POST /api/integrations`, `POST /api/integrations/:id/sync` (continúa siendo solicitud administrativa, no conector proveedor), `GET /api/integrations/events` |
| Analítica | `GET /api/analytics/summary`, `GET /api/reports/clients.csv` |
| Administración | `GET/POST /api/users`, `PATCH/DELETE /api/users/:id`, `GET /api/audit` |

## Modelos nuevos

`Restaurant`, `Reservation`, `Event`, `EventRegistration`, `Sale` e `IntegrationEvent`; se añadieron referencias desde `Client` y clave de idempotencia a `ClientActivity`. Los importes de ventas usan `Decimal(12,2)`; el modelo legado de actividad conserva `Float` por compatibilidad y requiere migración de datos planificada si se decide usarlo como libro contable.

## Integraciones reales: datos necesarios

Para activar POS, membresías, reservas, eventos, restaurantes y marketing se necesitan: nombre/proveedor y versión del producto, documentación OpenAPI/API, URL sandbox y producción, mecanismo de autenticación, webhooks disponibles, identificadores externos, reglas de sincronización y persona responsable. No se deben compartir claves privadas en el repositorio ni en el chat; usar un gestor de secretos.

El webhook POS actual acepta venta con `externalId`, `source`, `amount`, `soldAt`, `status` y opcionalmente `clientId`. Protege la ruta con `INTEGRATION_WEBHOOK_SECRET`. Para producción debe evolucionar a firma HMAC con timestamp, rotación de secretos, tolerancia anti-replay, allowlist/red privada cuando proceda y registro/cola de eventos con reintentos y dead-letter queue.

## Seguridad, privacidad y despliegue cloud

- Separar development, staging y production; usar PostgreSQL/Redis administrados, almacenamiento de objetos, gestor de secretos, WAF, logs centralizados, métricas y alertas.
- Aplicar MFA/SSO, revocación de sesiones, recuperación de contraseña, RBAC granular por departamento, revisión de permisos y política de bloqueo de cuentas antes de producción.
- CORS solo con dominios confiables; JWT_SECRET y secreto POS distintos por entorno. No usar datos reales en demos.
- Configurar backups cifrados y probar recuperación; objetivo inicial de referencia RPO 15 min/RTO 4 h sujeto a proveedor y presupuesto.
- Revisar tratamiento de datos personales conforme a Ley peruana 29733 y normativa vigente con asesoría legal; definir base legal, consentimiento, retención, derechos y controles de acceso.
- Añadir migraciones versionadas, pruebas unitarias/integración/E2E, análisis SCA/SAST, pruebas de carga y pentest antes del lanzamiento.

## Verificación pendiente

La sintaxis del archivo backend se comprobó con `node --check`. En el entorno de preparación no se completó la instalación npm, así que quedan pendientes: `npm ci`, `prisma validate`, `prisma generate`, build Vite, levantar Docker/PostgreSQL y ejecutar pruebas funcionales y de concurrencia. No considerar producción hasta completar esas verificaciones.

## Plantilla de contenedores para cloud

Se añadió `docker-compose.prod.yml`, `backend/Dockerfile.prod`, `frontend/Dockerfile.prod` y `frontend/nginx.conf`. La plantilla usa PostgreSQL administrado externo (no levanta una base local), sirve el frontend con Nginx y enruta `/api` hacia Express. Define en el entorno de despliegue `DATABASE_URL`, `JWT_SECRET`, `INTEGRATION_WEBHOOK_SECRET`, `FRONTEND_ORIGIN` y opcionalmente `WEB_PORT`. La capa de entrada del proveedor cloud debe terminar TLS/HTTPS y aplicar WAF.

La plantilla no ejecuta migraciones automáticamente: aplica un baseline y migraciones Prisma revisadas mediante un job de despliegue antes de actualizar el servicio. En este paquete no se incluyó una migración inicial generada/verificada porque no se pudo ejecutar Prisma CLI en el entorno de construcción; por ello primero se debe completar el baseline contra la base objetivo y no desplegar esta plantilla sobre producción sin esa tarea.
