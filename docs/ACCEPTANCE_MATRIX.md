# Matriz de aceptación y trazabilidad — CRM Atlantic City

Esta matriz define pruebas que deben ejecutarse en un entorno con PostgreSQL. La existencia de una ruta no equivale a que el caso de uso esté certificado.

| CU | Capacidad | Criterio de aceptación verificable | Estado de esta entrega |
|---|---|---|---|
| CU-01 | Registrar cliente | DNI normalizado; duplicado responde 409; campos validados | Implementado en API; prueba automatizada pendiente |
| CU-02 | Buscar cliente | Búsqueda paginada por DNI, nombre, apellido o correo con permisos | Implementado en API |
| CU-03 | Actualizar perfil | Validación de campos y auditoría del cambio | Implementado; revisar minimización de datos antes de producción |
| CU-04 | Autogestión | CLIENT solo modifica su propio perfil y campos permitidos | Implementado en API |
| CU-05 | Nivel VIP | Recalcular score por actividad de 365 días; vista previa dry-run | Implementación de referencia; umbrales requieren aprobación del negocio |
| CU-06 | Campañas segmentadas | Crear campaña y consultar audiencia; solo clientes con consentimiento quedan en audiencia utilizable | Implementado en API |
| CU-07 | Asignación/canje | Asignar por tier y vigencia; canje transaccional con límites | Implementado; prueba de concurrencia pendiente |
| CU-08 | Historial de promociones | Cliente ve sus asignaciones y estado | Implementado en API |
| CU-09 | Registrar incidencia | Crear ticket con número, canal y primer evento de historial | Implementado en API |
| CU-10 | Derivar ticket | Departamento editable y auditoría/historial | Implementado como actualización de ticket |
| CU-11 | Resolver incidencia | Transiciones validadas; resolución obligatoria al resolver | Implementado en API |
| CU-12 | Consultar reclamos | Cliente consulta solo tickets asociados a su cuenta | Implementado en API |
| CU-13 | KPIs/LTV/ROI | Resumen de clientes, campañas, beneficios, tickets y distribución VIP | KPIs básicos implementados; LTV/ROI reales pendientes de fuentes financieras verificadas |
| CU-14 | Reportes | Exportar clientes a CSV con mitigación de fórmulas | CSV de clientes implementado; otros reportes pendientes |
| CU-15 | Autenticación/RBAC | JWT con expiración, hash de contraseña y permisos por rol | Implementación inicial; MFA/SSO pendiente |
| CU-16 | Auditoría | Eventos de acciones críticas con actor y fecha | Implementado parcialmente; ampliar cobertura y retención en producción |
| CU-17 | Integraciones REST | Registro de conectores y estado de sincronización | Simulación explícita; conectores reales requieren contratos, credenciales y pruebas |

## Pruebas mínimas antes de aceptar una versión

1. Crear administrador inicial una sola vez y verificar que el endpoint no crea otro usuario después.
2. Crear dos clientes con el mismo DNI normalizado y confirmar que el segundo responde HTTP 409.
3. Verificar que CLIENT no puede leer ni modificar otro cliente ni sus tickets.
4. Registrar actividad con fecha dentro y fuera de los 365 días y comprobar el cálculo VIP, tanto `dryRun=true` como persistido.
5. Verificar que una campaña no asigna beneficios si no está ACTIVE, fuera de vigencia o si el cliente no consintió marketing.
6. Ejecutar dos canjes concurrentes y comprobar que no se supera `maxRedemptions`.
7. Comprobar todas las transiciones válidas e inválidas de estados de ticket y que resolver exige resolución.
8. Verificar auditoría de creación/actualización/canje/exportación e intentos de acceso denegados.
9. Confirmar que CSV neutraliza fórmulas en celdas controladas por usuarios.
10. Ejecutar escaneo de dependencias, pruebas de penetración y recuperación desde copia de seguridad.

## Criterio de finalización

El software no puede declararse 100% listo para producción solo con el código. Deben aprobarse las reglas VIP, políticas de consentimiento/retención, contratos de integración, controles de seguridad, pruebas de aceptación y operación de recuperación.
