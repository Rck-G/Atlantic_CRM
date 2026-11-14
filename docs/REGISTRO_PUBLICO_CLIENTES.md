# Registro público de clientes

## Objetivo
Permitir que un cliente cree su propia cuenta desde la pantalla de acceso del CRM Atlantic City.

## Interfaz
En la vista de acceso se incorporan dos pestañas: **Iniciar sesión** y **Crear cuenta**. El formulario de alta solicita nombres, apellidos, documento de identidad, teléfono, correo, contraseña y confirmación de contraseña. La autorización para recibir promociones es opcional y queda desmarcada por defecto.

## API
`POST /api/auth/register` es una ruta pública protegida por un límite de 5 solicitudes por hora y dirección de origen.

Ejemplo de payload:

```json
{
  "firstName": "Ana María",
  "lastName": "Pérez López",
  "dni": "12345678",
  "email": "ana@example.com",
  "phone": "+51 999 999 999",
  "password": "ClaveSegura#2026",
  "consentMarketing": false
}
```

La confirmación de contraseña se valida en el navegador y no se envía al servidor.

## Validaciones del servidor
- Nombres: 2–80 caracteres; apellidos: 2–100 caracteres; letras Unicode, espacios, punto, apóstrofo y guion.
- Documento: 5–20 caracteres alfanuméricos; se normaliza a mayúsculas y se eliminan espacios.
- Correo: formato válido, máximo 254 caracteres y normalizado a minúsculas.
- Teléfono: 7–20 caracteres, admite prefijo `+`, dígitos, espacios, paréntesis y guiones.
- Contraseña: 10–72 caracteres, al menos una mayúscula, minúscula, número y símbolo.
- `consentMarketing`: booleano; valor predeterminado `false`.
- DNI y correo no pueden estar ya asociados a otro registro incompatible.

## Creación de datos
La API ejecuta una transacción Prisma:
1. crea `Client` con datos personales y consentimiento;
2. crea `User` con el correo, hash bcrypt de contraseña y rol fijo `CLIENT`;
3. vincula `User.clientId` al cliente recién creado.

Si falla cualquiera de las dos inserciones, la transacción se revierte. La contraseña se procesa con bcrypt con coste 12; nunca se guarda en texto plano.

Tras la creación se registra `CLIENT_SELF_REGISTERED` en auditoría y se devuelve un JWT de ocho horas junto con los datos públicos mínimos del usuario. El frontend guarda el token en `sessionStorage` y carga la experiencia de cliente.

## Duplicados y vinculación
Si el documento ya existe como cliente, el registro se rechaza con HTTP 409 y se indica contactar a Atención al Cliente para vincular la cuenta. Esto evita que una persona reclame automáticamente un registro creado previamente por personal sin demostrar que es su titular. El flujo de vinculación verificada debe implementarse por separado.

## Seguridad y límites
- El rol no se recibe del navegador: el backend asigna `Role.CLIENT`.
- Límite de 5 intentos de registro por hora.
- Validación Zod en el backend; las validaciones HTML son solo apoyo de experiencia.
- Contraseña hasheada con bcrypt.
- El endpoint no expone hash ni datos internos.
- La autorización de cada endpoint posterior sigue dependiendo de los middlewares de roles y propiedad del recurso.

## Pendientes recomendados antes de producción
1. Verificación de correo mediante token de un solo uso con expiración.
2. CAPTCHA o protección anti-bot adaptativa.
3. Política de privacidad versionada y aceptación registrada con fecha, versión y evidencia.
4. Validación del documento conforme al país/tipo de documento que Atlantic City decida admitir.
5. Reglas de edad mínima y verificación de identidad según jurisdicción y política de cumplimiento aplicable.
6. Flujo seguro para vincular clientes preexistentes.
7. Pruebas de integración y pruebas de concurrencia para documento/correo duplicados.

**Importante:** la cuenta queda activa inmediatamente en esta implementación. No se afirma que el correo haya sido verificado. Para operación regulada o acceso a servicios sujetos a edad/identidad, deben completarse los controles anteriores antes de habilitar esos servicios.
