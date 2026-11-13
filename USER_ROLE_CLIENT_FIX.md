# Corrección: creación de cuentas con rol Cliente

En **Usuarios y roles**, al elegir el rol **Cliente**, el formulario ahora muestra un selector obligatorio para vincular la cuenta a un cliente existente (nombre, DNI y correo cuando esté disponible).

- Solo se muestran clientes que todavía no tienen una cuenta de acceso vinculada.
- Si no hay clientes disponibles, el formulario indica que primero se debe registrar un cliente.
- El botón de creación permanece deshabilitado mientras no se seleccione un cliente.
- El backend valida que el cliente enviado exista y devuelve un mensaje claro si no se encuentra.
- Para los demás roles no se envía `clientId`.

Esto conserva la regla de negocio del modelo: una cuenta con rol `CLIENT` debe asociarse a un registro `Client` existente.
