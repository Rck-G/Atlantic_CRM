# Dependencias y pendientes antes de declarar el CRM integral en producción

Esta entrega amplía la base de código, pero no sustituye decisiones operativas, credenciales de terceros ni controles de despliegue. Los siguientes puntos quedan explícitamente fuera de una afirmación de "producción lista":

## Integraciones externas
- POS, membresías, reservas, eventos, restaurantes y marketing: falta confirmar proveedor, versión, documentación, sandbox, autenticación y responsables. El CRM incorpora modelos, endpoints, webhook POS y bandeja de eventos, pero no existe un adaptador real específico conectado.
- La bandeja `IntegrationEvent` registra eventos; falta worker, política de reintentos, dead-letter queue, replay y conciliación automática.
- La seguridad de webhooks usa secreto compartido comparado en tiempo constante; antes de producción añadir firma HMAC con timestamp, anti-replay, rotación y credenciales distintas por proveedor.

## Reglas de negocio
- Umbrales/pesos VIP actuales son de referencia y requieren aprobación formal de Marketing/Finanzas.
- Definir duración de turnos, buffers, horarios, mesas/zonas, política de sobreventa y cancelación de reservas.
- Definir precios, cobros, depósitos, devoluciones, lista de espera y política de no-show.
- Definir capacidad por categoría de entrada, cupos VIP, cancelación y reembolso de eventos.
- Definir atribución de campañas, frecuencia de contacto, bajas y supresión por canal.

## Seguridad y privacidad
- MFA/SSO, recuperación de contraseña verificada por correo, cambio de contraseña, revocación de sesiones y política de dispositivos.
- RBAC granular por departamento/centro de costo y permisos de campo; el paquete conserva los cuatro roles existentes.
- Revisión legal de base jurídica, consentimiento, retención, derechos de titulares y controles bajo la Ley 29733 y normativa peruana vigente.
- Prueba de penetración, SAST/SCA, hardening, CSP, gestión de secretos y revisión de dependencias.
- `sessionStorage` reduce persistencia del token frente a `localStorage`, pero no elimina el riesgo XSS; considerar sesión HttpOnly Secure SameSite con protección CSRF.

## Plataforma y calidad
- Crear baseline y migraciones Prisma versionadas; la base actual se sincroniza en desarrollo con `prisma db push`.
- Probar en staging con PostgreSQL real, carga, concurrencia, restauración de backups, failover y recuperación.
- Añadir Redis/BullMQ, observabilidad OpenTelemetry, métricas, alertas, trazas, almacenamiento de objetos y procesos batch.
- Configurar CI/CD, aprobación de despliegues, rollback y secretos administrados por el proveedor cloud.
- Completar pruebas unitarias, integración, E2E y accesibilidad. En el entorno de preparación no fue posible instalar npm dependencies ni ejecutar Docker.

## Información que debe entregar el propietario del sistema
1. Proveedores y documentación API para POS, membresías, reservas, eventos y marketing.
2. URLs sandbox, autenticación y persona técnica responsable de cada proveedor.
3. Reglas aprobadas de puntos/VIP, campañas, beneficios, reservas y eventos.
4. Dominio cloud, región, proveedor, RTO/RPO aprobados y presupuesto operativo.
5. Política de privacidad, retención, consentimiento y matriz de acceso por departamento.
