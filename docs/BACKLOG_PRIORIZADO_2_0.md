# Backlog priorizado — CRM Atlantic City 2.0

Los tamaños son relativos (S/M/L/XL), no estimaciones de horas. Las prioridades P0–P3 indican orden recomendado.

| ID | Prioridad | Épica / historia | Criterio de aceptación resumido | Tamaño |
|---|---|---|---|---|
| SEC-01 | P0 | Migraciones Prisma versionadas | Baseline reproducible; staging y producción usan `migrate deploy`; no `db push` productivo. | L |
| SEC-02 | P0 | Pruebas de autorización por recurso | CLIENT no accede a IDs ajenos; roles internos solo ven funciones permitidas. | M |
| SEC-03 | P0 | Recuperación y cambio de contraseña | Tokens de un solo uso, expiración, invalidación y auditoría. | M |
| SEC-04 | P0 | Revocación de sesiones/MFA privilegiado | Cierre remoto y segundo factor para cuentas privilegiadas. | L |
| QA-01 | P0 | Pipeline CI | Instalación reproducible, validación Prisma, pruebas y build frontend. | M |
| QA-02 | P0 | Suite crítica API/E2E | Login, cliente, permisos, canje, reservas, eventos y tickets cubiertos. | L |
| CRM-01 | P1 | Perfil 360° | Una vista integra actividad, reservas, ventas importadas, tickets y beneficios. | L |
| CRM-02 | P1 | Deduplicación/importación | Previsualización, validación, conflictos y reporte descargable; reimportación idempotente. | L |
| CRM-03 | P1 | Segmentos guardados | Filtros dinámicos con propietario, fecha y permisos. | M |
| VIP-01 | P1 | Libro mayor de puntos | Todo abono/cargo/reverso tiene origen, actor, fecha e idempotencia. | XL |
| VIP-02 | P1 | Motor de reglas VIP | Reglas configurables, simulación, aprobación y vigencia. | L |
| VIP-03 | P1 | Catálogo de recompensas | Elegibilidad, stock/cupo, vencimiento y canje concurrente. | L |
| MKT-01 | P1 | Consentimiento por canal | Evidencia, fuente, fecha, versión y baja/supresión inmediata. | M |
| MKT-02 | P1 | Flujo de campañas | Aprobación, programación, envío, errores y métricas verificables. | XL |
| MKT-03 | P2 | Automatizaciones | Triggers configurables con límites de frecuencia y exclusiones. | L |
| OPS-01 | P1 | Mesas, zonas y turnos | Capacidad y solapamientos respetan horarios, buffers y cierres. | XL |
| OPS-02 | P1 | Lista de espera/no-show | Estados auditados y notificaciones según política. | M |
| OPS-03 | P1 | Gestión de eventos/check-in | Aforo concurrente, lista de asistentes y check-in único. | L |
| HD-01 | P1 | Colas y SLA HelpDesk | Asignación, vencimientos, escalamiento e historial. | L |
| UX-01 | P1 | Espacios de trabajo por departamento | Navegación y acciones adaptadas al rol; accesibilidad básica. | L |
| INT-01 | P1 | Contrato canónico de integración | Esquemas versionados y ejemplos; sin acoplar proveedor al dominio. | M |
| INT-02 | P2 | Cola/reintentos/dead-letter | Backoff, replay idempotente, alertas y conciliación. | L |
| INT-03 | P3 | Adaptador POS | Solo tras seleccionar proveedor, recibir documentación y probar sandbox. | XL |
| BI-01 | P1 | Diccionario de KPIs | Fórmulas, fuente, responsable, filtros y zona horaria documentados. | M |
| BI-02 | P2 | Dashboard ejecutivo | KPIs conciliados, filtros y exportación según permisos. | L |
| OPS-04 | P0 | Backups y recuperación | Backup cifrado y restauración cronometrada documentada. | M |
| OPS-05 | P0 | Observabilidad | Logs estructurados, métricas, alertas y correlación de solicitudes. | M |

## Primer sprint recomendado

1. Confirmar dueños de producto y reglas de permisos.
2. Levantar PostgreSQL de staging y generar baseline Prisma revisado.
3. Configurar CI y pruebas automáticas iniciales.
4. Auditar rutas por IDOR/BOLA y completar pruebas negativas.
5. Definir modelo de sesión, recuperación de contraseña y MFA administrativo.
6. Probar backup y restauración.

## Fuera de alcance hasta nueva decisión

- Integración productiva con POS: no hay proveedor identificado.
- Envíos reales por WhatsApp/email: seleccionar proveedor, obtener aprobación de privacidad y configurar credenciales primero.
- KPIs financieros LTV/ROI: no publicar como cifras oficiales hasta contar con datos financieros conciliados.
