# Arquitectura de referencia

- **Presentación:** React + JavaScript, Vite y CSS responsive.
- **Servicios:** Node.js + Express; API REST JSON, validación Zod, autenticación JWT, RBAC, rate limiting y auditoría.
- **Persistencia:** PostgreSQL; Prisma ORM para modelo y consultas.
- **Desacoplamiento:** el frontend consume la API mediante `VITE_API_URL`; no accede directamente a PostgreSQL.
- **Contenedores de desarrollo:** Docker Compose orquesta PostgreSQL, API y frontend.

```text
Navegador
   | HTTPS (en producción) / HTTP (local)
   v
React + JavaScript (Vite)
   | REST / JSON + JWT
   v
Node.js + Express
   | Prisma ORM
   v
PostgreSQL
```

Los conectores externos son un registro de configuración y una simulación de solicitud de sincronización. No se realizan llamadas a proveedores en el estado actual.
