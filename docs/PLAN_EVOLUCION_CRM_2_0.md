# Plan de evolución — CRM Atlantic City 2.0

**Alcance aprobado:** CRM integral para Gerencia, Marketing, Operaciones, Atención al Cliente y clientes finales.  
**POS:** proveedor no definido; no se implementará ni simulará una conexión productiva. Se mantendrá un contrato de integración desacoplado.  
**Base de trabajo:** paquete `CRM_Atlantic_City_Revisionado.zip`.

## 1. Resultado esperado

Una plataforma única para conocer al cliente, gestionar su ciclo de vida, ejecutar fidelización y campañas, coordinar reservas/eventos/atención, y entregar indicadores confiables a la dirección. La plataforma debe separar claramente los datos operativos de los datos financieros y conservar trazabilidad de las acciones sensibles.

## 2. Diagnóstico de la base actual

La base existente ya contiene React/Vite, Express, Prisma/PostgreSQL y módulos iniciales para clientes, usuarios, VIP, campañas, beneficios, tickets, restaurantes, reservas, eventos, ventas y bandeja de integración. Hay autenticación JWT, permisos por cuatro roles, validación Zod, rate limiting, auditoría parcial y documentación Swagger.

No debe confundirse la existencia de rutas/modelos con una función terminada. En particular:

- Las integraciones externas son un registro y una bandeja de recepción; no hay conectores de proveedores ni worker de procesamiento.
- El modelo VIP utiliza puntuaciones y umbrales de referencia que requieren aprobación de negocio.
- No existe un libro mayor de puntos con movimientos auditables.
- La segmentación y las campañas no tienen un motor de envíos, consentimiento por canal, bajas ni medición completa de resultados.
- Reservas no tienen gestión de mesas, turnos, zonas, lista de espera ni políticas completas de no-show.
- Los reportes son iniciales; no se deben presentar LTV, ROI ni rentabilidad como cifras certificadas sin fuentes financieras reconciliadas.
- Faltan migraciones versionadas, pruebas automatizadas completas, recuperación de contraseña, MFA, revocación de sesiones y RBAC granular.
- La interfaz es una base funcional, no todavía un portal completo diferenciado por departamento.

## 3. Principios de diseño

1. **Una sola ficha de cliente:** identificador maestro y referencias externas por sistema; evitar duplicados.
2. **API-first:** el frontend no accede directamente a PostgreSQL. Los procesos externos usan contratos versionados.
3. **Integración desacoplada:** adaptadores por proveedor; el núcleo CRM no depende de una marca de POS.
4. **Eventos e idempotencia:** cada evento externo tiene proveedor, identificador externo, fecha, estado, reintentos y trazabilidad.
5. **Seguridad por defecto:** mínimo privilegio, segregación por área, datos personales minimizados y auditoría.
6. **Datos financieros confiables:** importes en Decimal; ventas, devoluciones y anulaciones con estados explícitos y conciliación.
7. **Reglas configurables y aprobadas:** VIP, puntos, campañas y reservas no se fijan con umbrales arbitrarios en código.
8. **Despliegue gradual:** desarrollo → QA/staging → piloto → producción, con migraciones y rollback.

## 4. Plan por fases

### Fase 0 — Descubrimiento y definición (1–2 semanas)

**Trabajo**
- Talleres con Gerencia, Marketing, Operaciones, Atención al Cliente y TI.
- Definir procesos actuales y responsables de cada dato.
- Aprobar matriz de roles, departamentos, centros/áreas y permisos por acción.
- Definir reglas VIP/puntos, reservas, eventos, campañas y tratamiento de datos personales.
- Inventariar sistemas actuales: POS, reservas, membresías, email, WhatsApp, ERP/contabilidad y proveedores de identidad.
- Definir indicadores, fórmulas, periodicidad, fuente y propietario de cada KPI.

**Entregables**: mapa de procesos, catálogo de datos, matriz RACI, matriz de permisos, reglas de negocio aprobadas, inventario de sistemas y backlog priorizado.

**Criterio de salida**: responsables de negocio firman las reglas; TI identifica entornos y sistemas fuente.

### Fase 1 — Estabilización y seguridad (2–3 semanas)

**Trabajo**
- Crear baseline y migraciones Prisma versionadas; retirar `db push` del procedimiento de producción.
- Añadir pruebas unitarias, integración API/PostgreSQL y E2E de los flujos críticos.
- Corregir y probar autorización por rol y propiedad del registro (IDOR/BOLA).
- Implementar recuperación de contraseña verificada, cambio de contraseña, revocación de sesiones y política de expiración.
- Evaluar sesión HttpOnly/Secure/SameSite con protección CSRF frente a JWT en `sessionStorage`.
- Añadir MFA para administradores y perfiles privilegiados.
- Completar auditoría de altas, cambios, exportaciones, canjes, cambios de permisos y accesos denegados.
- Añadir límites de paginación, validación consistente, manejo de errores, correlación de solicitudes y logs estructurados.
- Configurar CI: instalación reproducible, Prisma validate/generate, build frontend, pruebas y escaneo de dependencias.

**Entregables**: versión estabilizada, migraciones, pipeline CI, informe de seguridad y matriz de pruebas ejecutadas.

**Criterio de salida**: cero fallos críticos/altos abiertos en pruebas de seguridad; flujos críticos aprobados en staging; restauración de backup demostrada.

### Fase 2 — CRM 360° y calidad de datos (3–4 semanas)

**Trabajo**
- Consolidar ficha 360°: datos de contacto, preferencias, consentimiento, visitas, compras importadas, reservas, eventos, tickets y beneficios.
- Crear resolución de identidad y detección de duplicados (DNI normalizado, email/teléfono con reglas y revisión manual).
- Añadir historial de cambios y fuente de cada dato; evitar sobrescritura ciega entre sistemas.
- Incorporar etiquetas, segmentos dinámicos y filtros guardados.
- Añadir importación CSV con previsualización, validación, deduplicación, reporte de errores y auditoría.
- Añadir exportaciones con permisos, minimización de columnas y registro de descarga.

**Entregables**: perfil 360°, herramientas de calidad de datos, importación y segmentación.

**Criterio de salida**: cada atributo crítico tiene fuente y reglas de precedencia; importaciones repetidas no duplican clientes.

### Fase 3 — Fidelización y beneficios (3–4 semanas)

**Trabajo**
- Diseñar libro mayor inmutable de puntos: acumulación, canje, ajuste, vencimiento, reverso y origen.
- Configurar reglas por importe, actividad, categoría, campaña, vigencia y límites.
- Definir niveles VIP, umbrales, ventana de evaluación, downgrade/gracia y beneficios por nivel.
- Crear motor transaccional de acumulación/canje con idempotencia y control de concurrencia.
- Añadir historial visible para cliente y backoffice, alertas de vencimiento y panel de responsabilidad.

**Entregables**: motor de puntos/VIP, catálogo de recompensas, historial y consola de reglas.

**Criterio de salida**: pruebas de concurrencia y reversos; cada punto puede rastrearse hasta su transacción de origen.

### Fase 4 — Marketing y automatización (3–5 semanas)

**Trabajo**
- Consentimiento y preferencias por canal, evidencia de alta, fecha/fuente y baja inmediata.
- Segmentos dinámicos con exclusiones y reglas de frecuencia.
- Flujo de campaña: borrador → aprobación → programación → envío → métricas.
- Integrar primero un proveedor elegido de correo y luego WhatsApp Business oficial, usando credenciales de servidor.
- Plantillas aprobadas, variables, pruebas de envío, listas de supresión y control de rebotes.
- Registrar entregado, fallido, clic, conversión cuando el proveedor lo permita; no inferir aperturas no verificables.
- Automatizaciones por cumpleaños, inactividad, aniversario, cambio VIP y vencimiento de beneficios.

**Entregables**: módulo de campañas operativo, conectores seleccionados y métricas.

**Criterio de salida**: ningún contacto sin base/consentimiento aplicable; baja y supresión verificadas de extremo a extremo.

### Fase 5 — Operaciones: reservas, restaurantes, eventos y HelpDesk (4–5 semanas)

**Trabajo**
- Reservas: mesas/zonas, turnos, duración, buffers, capacidad, lista de espera, confirmación, cancelación y no-show.
- Eventos: cupos por categoría, lista de asistentes, check-in, cancelación, reembolso si aplica y control de aforo concurrente.
- HelpDesk: colas por departamento, SLA, asignación, escalamiento, macros, adjuntos seguros y encuestas.
- Portal cliente: autogestión de perfil, preferencias, reservas, inscripciones, beneficios y tickets.
- Vistas de trabajo diferenciadas para recepción, restaurantes, marketing, soporte y gerencia.

**Entregables**: consola de operaciones y portal de cliente.

**Criterio de salida**: no hay sobreventa de aforo/mesas en pruebas concurrentes; los cambios de estado dejan historial.

### Fase 6 — Integraciones y datos empresariales (3–6 semanas, depende de proveedores)

**Trabajo**
- Definir contrato canónico versionado para cliente, venta, devolución, visita, reserva y evento.
- Crear adaptadores separados por proveedor y ambiente (sandbox/producción).
- Implementar firma HMAC con timestamp, anti-replay, rotación de secretos, idempotencia y allowlist cuando corresponda.
- Procesamiento asíncrono con cola, reintentos exponenciales, dead-letter queue, replay controlado y conciliación.
- No habilitar un adaptador hasta contar con documentación oficial, sandbox, credenciales seguras y dueño técnico.
- POS queda como adaptador futuro; mientras no exista proveedor, no se fabricarán ventas ni se mostrará sincronización exitosa.

**Entregables**: contratos, adaptadores certificados, tablero de sincronización y conciliación.

**Criterio de salida**: pruebas de sandbox aprobadas, conciliación de totales/estados y manejo documentado de fallos.

### Fase 7 — Analítica gerencial y puesta en producción (3–4 semanas)

**Trabajo**
- Dashboard por rol con definiciones y fuentes documentadas.
- KPIs: altas, clientes activos, recurrencia, frecuencia, ticket promedio, ventas conciliadas, puntos emitidos/canjeados, reservas, ocupación, SLA y conversiones.
- LTV/ROI solo después de validar fuentes, ventanas, costos y atribución.
- Exportación programada, filtros por periodo/área y permisos de datos.
- Observabilidad, alertas, backups cifrados, restauración, pruebas de carga, plan de continuidad y rollback.
- Piloto por área, capacitación, manuales y aceptación formal.

**Entregables**: dashboard ejecutivo, runbooks, capacitación y acta de salida a producción.

**Criterio de salida**: KPIs conciliados con sus sistemas fuente; operación y recuperación ensayadas; aprobación de responsables.

## 5. Modelo de permisos propuesto

| Perfil | Alcance recomendado |
|---|---|
| Cliente | Solo su perfil, beneficios, reservas, eventos y tickets propios; preferencias y consentimientos propios. |
| Atención al cliente | Ficha y atención necesarias; sin exportación masiva ni configuración financiera. |
| Operaciones/Restaurantes | Reservas, mesas, eventos y datos mínimos del cliente para prestar el servicio. |
| Marketing | Segmentos y campañas; solo datos de contacto con permiso aplicable; no administrar usuarios ni ver datos sensibles innecesarios. |
| Gerencia | Indicadores y reportes agregados; acceso nominal excepcional y auditado. |
| Administrador TI | Usuarios, configuración técnica e integraciones; acceso a datos de negocio sujeto a necesidad y auditoría. |

Los roles actuales (`CLIENT`, `EMPLOYEE`, `MARKETING`, `ADMIN`) son insuficientes para esta separación final. Se recomienda autorización basada en permisos (RBAC granular) y atributos de departamento/sede, conservando compatibilidad durante la transición.

## 6. Modelo de datos que debe evolucionar

- `LoyaltyAccount`, `LoyaltyLedgerEntry`, `LoyaltyRule`, `Reward` y `RewardRedemption`.
- `ConsentRecord`, `ContactPreference`, `SuppressionEntry` y `CampaignDelivery`.
- `CustomerIdentifier` y `ExternalReference` para identidad y claves de proveedor.
- `RestaurantArea`, `Table`, `ServiceShift`, `WaitlistEntry` y `ReservationStatusHistory`.
- `EventTicket`, `CheckIn` y `EventStatusHistory`.
- `Department`, `Permission`, `RolePermission`, `UserDepartment` y `Session`.
- `IntegrationEndpoint`, `IntegrationCredentialReference`, `IntegrationAttempt` y `DeadLetterEvent`.
- `Attachment` con almacenamiento privado, antivirus y URLs temporales firmadas.

No se deben almacenar secretos de proveedores en tablas de texto plano. Guardar referencias a un gestor de secretos.

## 7. Indicadores y reglas de cálculo

Cada KPI debe tener: nombre, definición, fórmula, fuente, granularidad, zona horaria, filtros, propietario y fecha de actualización. Por ejemplo, “cliente activo” debe definirse por negocio (visita/compra dentro de una ventana), no asumirlo por tener una cuenta. “Venta” debe distinguir venta pagada, anulada, devuelta y pendiente. El ticket promedio debe usar ventas netas conciliadas y excluir anulaciones/devoluciones según regla aprobada.

## 8. Cronograma de referencia

Estimación orientativa: 20–30 semanas con equipo pequeño y disponibilidad de responsables de negocio. Fases 2–5 pueden solaparse parcialmente después de estabilizar contratos y datos. La fase 6 depende directamente de que los proveedores entreguen APIs/sandbox. No es una promesa de fecha hasta confirmar equipo, alcance y dependencias.

## 9. Equipo mínimo sugerido

- Product Owner/representante de Gerencia: priorización y aceptación.
- Analista funcional: procesos, reglas y criterios.
- Líder técnico/backend: arquitectura, seguridad e integraciones.
- Frontend: vistas por rol y portal.
- QA: automatización y aceptación.
- DevOps/seguridad: CI/CD, infraestructura, monitoreo y recuperación.
- Responsables de Marketing, Operaciones y Atención: validación funcional.

## 10. Decisiones que bloquean el inicio de construcción funcional

1. Responsable de producto y responsables por módulo.
2. Reglas VIP/puntos y presupuesto de beneficios.
3. Proveedor de correo y canal oficial de WhatsApp (si se aprueba).
4. Proveedor de reservas/restaurantes y política de aforo.
5. Política de privacidad, retención, consentimiento y atención de derechos bajo normativa peruana vigente.
6. Infraestructura cloud, ambientes, RPO/RTO y presupuesto.
7. Proveedor POS futuro y su API; hasta entonces, la integración POS permanece deshabilitada.

## 11. Definición de “listo para producción”

No se considera listo hasta que: migraciones se apliquen en staging; CI y pruebas E2E pasen; permisos y privacidad se prueben; no haya vulnerabilidades críticas/altas sin tratamiento; backups se restauren; integraciones se concilien; métricas se validen; exista monitoreo y rollback; y los responsables firmen aceptación.
