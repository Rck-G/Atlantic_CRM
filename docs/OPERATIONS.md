# Guía de operación y endurecimiento

## Entorno local

1. Instalar Node.js 20+ y Docker Desktop.
2. Copiar `.env.example` a `.env`.
3. Cambiar `JWT_SECRET` por un secreto aleatorio de al menos 32 bytes; no reutilizar el ejemplo.
4. Ejecutar `docker compose up --build`.
5. Comprobar `GET http://localhost:4000/api/health`, abrir `http://localhost:5173` y consultar `http://localhost:4000/api/docs`.
6. Crear el primer administrador con `POST /api/auth/bootstrap-admin`; después del alta, el endpoint devuelve conflicto si ya hay usuarios. Para producción se recomienda eliminar/deshabilitar explícitamente esta ruta y crear el administrador mediante un proceso operativo controlado.

## Endpoints de negocio añadidos

- `POST /api/clients/:id/activity` — registrar actividad con fuente, tipo, importe opcional y fecha; roles EMPLOYEE/ADMIN.
- `POST /api/vip/recalculate` — recalcular niveles de todos los clientes o uno (`clientId`); `dryRun: true` permite previsualizar sin persistir.
- `GET /api/campaigns/:id/audience` — previsualizar audiencia compatible con nivel VIP y consentimiento.
- `POST /api/campaigns/:id/assign-benefits` — asignar beneficios de campaña ACTIVE y vigente a clientes que dieron consentimiento, respetando el nivel VIP.

## Modelo VIP de referencia

El score de ejemplo usa la actividad registrada en los últimos 365 días: gasto anual dividido entre 100 más 10 puntos por actividad de visita/juego/restaurante/evento. Niveles: SILVER para score menor a 250; GOLD de 250 a menos de 1000; PLATINUM desde 1000. Estos umbrales no son una política comercial aprobada; deben ser parametrizados y validados por Marketing, Finanzas y Cumplimiento antes de producción.

## Reglas críticas

- No usar datos reales hasta aprobar privacidad, seguridad, roles y retención.
- `POST /api/integrations/:id/sync` no contacta sistemas externos; únicamente registra el intento. No presentar la sincronización simulada como una integración funcional.
- LTV/ROI no deben inferirse de `ClientActivity` sin acordar ingresos netos, costes, devoluciones, atribución y ventanas temporales.
- Proteger `.env`, no versionarlo y gestionar secretos con un vault en producción.
- Configurar HTTPS, CORS por dominio, copias cifradas, recuperación probada, alertas, logs centralizados y límites específicos para login.
- Añadir MFA/SSO, política de contraseñas, bloqueo progresivo, revisión de sesiones y proceso de revocación antes de despliegue real.
- Definir acceso mínimo por rol; validar con asesoría las obligaciones aplicables a datos personales y datos de actividad de juego.
