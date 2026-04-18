/**
 * Mapa de códigos de error del back → mensajes en español para el usuario.
 * Códigos fuente: Back/core/exceptions.py y Back/core/errores.py
 *
 * Regla de dos mensajes por clase: cuando la excepción define dos default_message
 * en Python, el primero corresponde al front de usuario y el segundo al front de empresa.
 * Este archivo es el front de empresa: se usa el mensaje de empresa en cada caso.
 *
 * Interpolación: los placeholders {variable} se reemplazan con los valores del
 * objeto `metadata` que devuelve el back junto al código de error.
 */

const ERROR_MAP = {

  // ── Red / sistema ────────────────────────────────────────────────────────────
  NETWORK_ERROR:
    'No se pudo conectar con el servidor. Revisá tu conexión.',
  INTERNAL_ERROR:
    'Ocurrió un error interno. Intentá de nuevo en un momento.',
  SYSTEM_ERROR:
    'Error interno del sistema. Intentá de nuevo en un momento.',

  // ── Códigos genéricos de clases base (fallback cuando se lanza la clase padre) ─
  DOMAIN_ERROR:
    'Ocurrió un error. Intentá de nuevo.',
  USER_ERROR:
    'Error relacionado con el usuario.',
  EMPRESA_ERROR:
    'Error relacionado con la empresa.',
  EMPRESA_PERMISSION_DENIED:
    'No tenés permiso para realizar esta acción.',
  SUCURSAL_ERROR:
    'Error relacionado con la sucursal.',
  SUCURSAL_PERMISSION_DENIED:
    'No tenés permiso para realizar esta acción en esta sucursal.',
  SUCURSAL_SERVICE:
    'Error en el servicio.',
  SUCURSAL_EXCEPTION_DATE_SERVICE:
    'Error en los bloqueos de fechas del servicio.',
  CLIENTE_ERROR:
    'Error relacionado con el cliente.',
  TURNO_ERROR:
    'Error en el turno.',
  TURNO_RESERVA:
    'Error al reservar el turno.',
  TURNO_UPDATE:
    'Error al modificar el turno.',
  TURNO_DELETE:
    'Error al eliminar el turno.',
  PASSWORD_ERROR:
    'Error relacionado con la contraseña.',
  CHANGE_PASSWORD:
    'Error al cambiar la contraseña.',
  INVITATION_ERROR:
    'No se pudo completar la invitación.',
  LOGO_ERROR:
    'Error al procesar el logo.',
  GEOREF_ERROR:
    'Error en el servicio de geolocalización.',

  // ── Autenticación ─────────────────────────────────────────────────────────────
  USER_INVALID_CREDENTIALS:
    'Email o contraseña incorrectos. Revisá los datos ingresados.',
  AUTH_ERROR:
    'Error de autenticación.',
  VERIFY_EMAIL_INVALID_EXPIRED_TOKEN:
    'El enlace de verificación no es válido o ha expirado.',

  // ── Validación Pydantic (422) ─────────────────────────────────────────────────
  VALIDATION_ERROR:
    'Hay errores en los datos ingresados. Revisá los campos e intentá de nuevo.',
  FIELD_REQUIRED:
    'Este campo es obligatorio.',
  INVALID_INPUT:
    'El valor ingresado no es válido.',
  INVALID_INTEGER:
    'El valor debe ser un número entero.',
  INVALID_FLOAT:
    'El valor debe ser un número.',
  INVALID_STRING:
    'El valor debe ser texto.',
  INVALID_BOOLEAN:
    'El valor debe ser verdadero o falso.',
  INVALID_EMAIL:
    'El email no tiene un formato válido.',
  STRING_TOO_SHORT:
    'El valor ingresado es demasiado corto.',
  STRING_TOO_LONG:
    'El valor ingresado es demasiado largo.',
  VALUE_TOO_SMALL:
    'El valor ingresado es demasiado bajo.',
  VALUE_TOO_LARGE:
    'El valor ingresado es demasiado alto.',
  NOT_MULTIPLE_OF:
    'El valor debe ser múltiplo del valor requerido.',
  INVALID_FORMAT:
    'El formato del valor ingresado no es válido.',
  INVALID_DECIMAL:
    'El valor debe ser un número decimal válido.',
  DECIMAL_TOO_MANY_DIGITS:
    'El número tiene demasiados dígitos.',
  DECIMAL_TOO_MANY_PLACES:
    'El número tiene demasiados decimales.',
  INVALID_DATE:
    'La fecha ingresada no es válida.',
  INVALID_TIME:
    'La hora ingresada no es válida.',
  INVALID_DATETIME:
    'La fecha y hora ingresada no es válida.',
  LIST_TOO_SHORT:
    'La lista tiene menos elementos de los requeridos.',
  LIST_TOO_LONG:
    'La lista tiene más elementos de los permitidos.',
  INVALID_LIST:
    'El valor debe ser una lista.',
  INVALID_ENUM_VALUE:
    'El valor seleccionado no es una opción válida.',
  INVALID_URL:
    'La URL ingresada no tiene un formato válido.',

  // ── Usuario ───────────────────────────────────────────────────────────────────
  USER_NOT_FOUND:
    'Usuario no encontrado.',
  USER_EMAIL_NOT_VERIFIED:
    'Tu email no fue verificado aún.',
  USER_ALREADY_EXISTS_BUT_NOT_VERIFIED:
    'Ya existe una cuenta registrada con ese email que no fue verificado aún. Revisá tu casilla de correo para confirmar tu cuenta.',
  USER_VERIFICATION_EMAIL_RESENT:
    'Tu email no fue verificado aún. Revisá tu casilla de correo para confirmar tu cuenta.',
  USER_ALREADY_EXISTS:
    'Ya existe una cuenta registrada con ese email.',
  USER_EMPRESA_MIEMBRO_ALREADY_EXISTS:
    'Ya poseés un rol en esta empresa.',
  USER_BLOCKED_BY_SUCURSAL:
    'Fuiste bloqueado por {nombre_empresa}.',

  // ── Contraseña ────────────────────────────────────────────────────────────────
  PASSWORD_INCORRECT:
    'La contraseña actual es incorrecta.',
  PASSWORD_INVALID_FORMAT:
    'La nueva contraseña no puede ser igual a la anterior.',
  RESET_PASSWORD:
    'El enlace de recuperación no es válido o ha expirado.',
  RESET_OTP:
    'El código ingresado es inválido o ha expirado.',

  // ── Empresa ───────────────────────────────────────────────────────────────────
  EMPRESA_NOT_FOUND:
    'Empresa no encontrada.',
  EMPRESA_EMAIL_NOT_VERIFIED:
    'El email de la empresa no fue verificado aún.',
  EMPRESA_ALREADY_EXISTS_BUT_NOT_VERIFIED:
    'Ya existe una empresa registrada con ese email que no fue verificado aún. Revisá la casilla de correo para confirmar la empresa.',
  EMPRESA_VERIFICATION_EMAIL_RESENT:
    'El email de la empresa no fue verificado aún. Revisá la casilla de correo para poder acceder al menú de la empresa.',
  EMPRESA_ALREADY_EXISTS:
    'Ya existe una empresa registrada con ese email.',
  EMPRESA_HAS_NO_SUCURSAL:
    'La sucursal no tiene domicilio asociado.',
  EMPRESA_MIEMBRO_NOT_FOUND:
    'El usuario no pertenece a esta empresa.',
  EMPRESA_MIEMBRO_ALREADY_EXISTS:
    'No se puede invitar otra vez a un usuario que ya posee un rol en esta empresa.',
  EMPRESA_PROPIETARIO_OUT:
    'La empresa no puede quedar sin propietarios.',
  EMPRESA_PROFESIONAL_CON_TURNOS_CONFIRMADOS_OUT:
    'No se puede eliminar a un miembro que tiene turnos confirmados como profesional.',
  EMPRESA_INVALID_SELF_REMOVAL:
    'No podés abandonar la empresa desde este flujo.',
  EMPRESA_MIEMBRO_DELETE_WITH_TURNOS_CONFIRMADOS:
    'No se puede eliminar a un miembro que aún posee turnos confirmados como profesional.',
  EMPRESA_PERMISSION_DENIED:
    'No tenés permiso para realizar esta acción.',
  EMPRESA_ACCESS_GLOBAL_RESOURCES_FORBIDDEN:
    'No tenés acceso a los recursos globales de esta empresa.',
  EMPRESA_ACCESS_RESOURCES_FORBIDDEN:
    'No tenés acceso a los recursos de esta empresa.',
  EMPRESA_UPDATED_BY_EMPLEADO:
    'Los empleados no pueden modificar datos de la empresa.',
  EMPRESA_MIEMBROS_VIEWED_BY_EMPLEADO:
    'Los empleados no pueden ver la lista de miembros de la empresa.',
  EMPRESA_ROL_UPDATE:
    'Solo miembros de rango superior pueden modificar el rol de otro miembro.',
  EMPRESA_ROL_CANNOT_ASSIGN_GERENTE_SUCURSAL:
    'No se puede asignar el rol de gerente de sucursal a una empresa con menos de dos sucursales.',
  EMPRESA_PERSONAL_ROL_PROPIETARIO_UPDATE:
    'Un propietario solo puede degradarse a gerente de empresa.',
  EMPRESA_ROL_NOT_ASSIGNED_BY_PROPIETARIO:
    'Solo los propietarios pueden asignar roles globales de empresa.',
  EMPRESA_MIEMBRO_DELETE:
    'Solo miembros de rango superior pueden eliminar a otro miembro.',

  // ── Sucursal ──────────────────────────────────────────────────────────────────
  SUCURSAL_NOT_FOUND:
    'Sucursal no encontrada.',
  SUCURSAL_DEACTIVATED:
    'Sucursal fuera de servicio.',
  SUCURSAL_ALREADY_EXISTS_WITH_NAME:
    'Ya existe una sucursal con ese nombre en esta empresa.',
  SUCURSAL_ALREADY_EXISTS_WITHOUT_NAME:
    'Ya existe una sucursal sin nombre en esta empresa.',
  SUCURSAL_RESERVA_PUBLICA_INHABILITADA:
    '{nombre} no permite reserva de turnos online por el momento.',
  SUCURSAL_RESERVA_EXCEPTION_DATE_SERVICE:
    'La reserva para este servicio en esta fecha está inhabilitada: {motivo}.',
  SUCURSAL_DEACTIVATE_WITH_ONE_SUCURSAL_IN_EMPRESA:
    'Una empresa no puede quedar sin sucursales activas.',
  SUCURSAL_DEACTIVATE_WITH_TURNOS_CONFIRMADOS:
    'No se puede desactivar una sucursal que posee turnos confirmados.',
  SUCURSAL_MIEMBRO_NOT_FOUND:
    'El usuario no pertenece a esta sucursal.',
  SUCURSAL_MIEMBRO_ALREADY_EXISTS:
    'El usuario ya pertenece a esta sucursal.',
  SUCURSAL_PROFESIONAL_WITH_TURNOS_CONFIRMADOS_OUT:
    'No se puede abandonar la sucursal mientras tengas turnos confirmados como profesional.',
  SUCURSAL_MIEMBRO_DELETE_WITH_TURNOS_CONFIRMADOS:
    'No se puede eliminar a un miembro de una sucursal que aún tiene turnos confirmados como profesional.',
  SUCURSAL_MIEMBRO_ADD:
    'No se puede agregar a este miembro a la sucursal desde este flujo.',
  SUCURSAL_INVALID_SELF_REMOVAL:
    'No podés abandonar la sucursal desde este flujo.',
  SUCURSAL_PERMISSION_DENIED:
    'No tenés permiso para realizar esta acción en esta sucursal.',
  SUCURSAL_CREATED_BY_GERENTE_EMPRESA:
    'Los gerentes de empresa no pueden crear sucursales.',
  SUCURSAL_ACCESS_RESOURCES_FORBIDDEN:
    'No tenés acceso a los recursos de esta sucursal.',
  SUCURSAL_DEACTIVATE_FORBIDDEN:
    'Solo el propietario puede desactivar la sucursal.',
  SUCURSAL_ACTIVATE_FORBIDDEN:
    'Solo el propietario puede reactivar la sucursal.',
  SUCURSAL_ROL_ASSIGNED_BY_EMPLEADO:
    'Los empleados no pueden asignar roles.',
  SUCURSAL_ROL_ASSIGNED_BY_GERENTE:
    'Los gerentes de sucursal no pueden asignar roles de gerente.',
  SUCURSAL_CLIENTE_UNLOCKED_BY_EMPLEADO:
    'Los empleados no pueden desbloquear clientes.',

  // ── Servicios de sucursal ─────────────────────────────────────────────────────
  SUCURSAL_SERVICE_NOT_FOUND:
    'Servicio no encontrado.',
  SUCURSAL_SERVICE_ALREADY_EXISTS:
    'Ya existe un servicio con ese nombre y profesional (o sin profesional).',
  SUCURSAL_SERVICE_RANGOS_FECHAS:
    'Un servicio no puede tener más de dos versiones de vigencia activas al mismo tiempo.',
  SUCURSAL_SERVICE_POSTERIOR_FECHA_INICIO_VIGENCIA:
    'La fecha de inicio de la nueva versión debe ser posterior a la fecha de inicio de la versión actual.',
  SUCURSAL_SERVICE_SUPERPUESTO:
    'Los rangos de fechas de vigencia de un mismo servicio no pueden superponerse.',
  SUCURSAL_SERVICE_DISPONIBILIDAD_SUPERPUESTA:
    'Los horarios en un mismo día para un mismo servicio no pueden superponerse.',
  SUCURSAL_SERVICE_UPDATE_DISPONIBILIDAD_WITH_TURNOS_EXISTENTES:
    'La disponibilidad del día {dia} a las {hora} hs no puede reducirse a {cant_turnos_max} simultáneos: ya hay {cant_turnos_actual} turnos confirmados para el {fecha}.',
  SUCURSAL_SERVICE_UPDATE_VIGENCIA_WITH_TURNOS_EXISTENTES:
    'No se puede reducir el período de vigencia: hay {cant_turnos_actual} turnos confirmados que quedarían fuera del nuevo rango.',
  SUCURSAL_SERVICE_DELETE_DISPONIBILIDAD_WITH_TURNOS_EXISTENTES:
    'La disponibilidad del día {dia} a las {hora} hs no puede eliminarse: hay {cant_turnos_actual} turnos confirmados para el {fecha}.',
  SUCURSAL_SERVICE_DELETE_WITH_TURNOS_CONFIRMADOS:
    'No se puede eliminar un servicio o versión que posee turnos confirmados.',
  SUCURSAL_SERVICE_VIEWED_BY_EMPLEADO:
    'Los empleados no pueden visualizar los servicios.',
  SUCURSAL_SERVICE_CREATED_BY_EMPLEADO:
    'Los empleados no pueden crear servicios.',
  SUCURSAL_SERVICE_UPDATED_BY_EMPLEADO:
    'Los empleados no pueden modificar servicios.',
  SUCURSAL_SERVICE_DELETED_BY_EMPLEADO:
    'Los empleados no pueden eliminar servicios.',

  // ── Bloqueos de fechas de servicio ────────────────────────────────────────────
  SUCURSAL_EXCEPTION_DATE_SERVICE_NOT_FOUND:
    'Bloqueo de fecha del servicio no encontrado.',
  SUCURSAL_EXCEPTION_DATE_SERVICE_SUPERPUESTA:
    'Los bloqueos de fechas de un mismo servicio no pueden superponerse.',
  SUCURSAL_EXCEPTION_DATE_SERVICE_CREATE_WITH_TURNOS_CONFIRMADOS:
    'No se puede bloquear fechas de un servicio que ya tiene turnos confirmados en ese rango.',
  // Empresa front: segundo default_message de Python (más descriptivo para el admin)
  SUCURSAL_EXCEPTION_DATE_SERVICE_UPDATE_WITH_TURNOS_CONFIRMADOS:
    'No se puede extender el rango de fechas de vigencia para el actual bloqueo debido a que incluiría turnos confirmados.',
  SUCURSAL_EXCEPTION_DATE_SERVICE_CREATED_BY_EMPLEADO:
    'Los empleados no pueden bloquear fechas de un servicio.',
  SUCURSAL_EXCEPTION_DATE_SERVICE_UPDATED_BY_EMPLEADO:
    'Los empleados no pueden modificar bloqueos de fechas de un servicio.',
  SUCURSAL_EXCEPTION_DATE_SERVICE_DELETED_BY_EMPLEADO:
    'Los empleados no pueden eliminar bloqueos de fechas de un servicio.',

  // ── Clientes ──────────────────────────────────────────────────────────────────
  CLIENTE_NOT_FOUND:
    'Cliente no encontrado.',
  CLIENTE_ALREADY_EXISTS:
    'Ya existe un cliente registrado con ese email en esta sucursal.',
  CLIENTE_DEACTIVATE_WITH_TURNOS_CONFIRMADOS:
    'No se puede desactivar a un cliente que tiene turnos confirmados.',
  CLIENTE_BLOCKED:
    'Este cliente se encuentra bloqueado.',
  CLIENTE_ALREADY_BLOCKED:
    'Este cliente ya se encuentra bloqueado.',

  // ── Roles ─────────────────────────────────────────────────────────────────────
  ROL_INVALID:
    'El rol especificado no es válido.',

  // ── Turnos ────────────────────────────────────────────────────────────────────
  TURNO_NOT_FOUND:
    'Turno no encontrado.',
  TURNO_SIN_DISPONIBILIDAD:
    'No hay turnos disponibles para este horario.',
  TURNO_RESERVA_ANTICIPACION_INVALID:
    'El turno debe reservarse con al menos {minutos_minimos} minutos de anticipación.',
  TURNO_RESERVA_FUERA_DE_RANGO:
    'El turno excede el límite máximo de {dias_max} días permitido por esta empresa.',
  TURNO_RESERVA_DISPONIBILIDAD_NO_CONFIGURADA:
    'No hay disponibilidad configurada para este servicio en el horario seleccionado.',
  TURNO_USER_OVERLAPPING_APPOINTMENT:
    'Tenés un turno que se superpone con el seleccionado.',
  TURNO_CLIENTE_OVERLAPPING_APPOINTMENT:
    'El cliente tiene un turno que se superpone con el seleccionado.',
  TURNO_PROFESIONAL_OVERLAPPING_APPOINTMENT:
    'El profesional {apellido}, {nombre} ya tiene otro turno en ese horario.',
  TURNO_UPDATE_INVALID_STATE:
    'El estado del turno no es válido.',
  TURNO_CANCEL_TIME_EXPIRED:
    'No se puede cancelar un turno que ya comenzó o terminó.',
  TURNO_NOT_FINISHED:
    'El turno no ha finalizado aún. Intentá más tarde.',
  TURNO_UPDATE_STATE_IMMUTABLE:
    'El estado del turno no puede volver a modificarse.',
  TURNO_CANCELED_BY_MIEMBRO_FORBIDDEN:
    'Solo el profesional del servicio o un miembro de rango superior puede cancelar este turno.',
  TURNO_DELETE_STATE_CONFLICT:
    'Debés cambiar el estado del turno antes de eliminarlo.',

  // ── Notificaciones ────────────────────────────────────────────────────────────
  NOTIFICACION_NOT_FOUND:
    'Notificación no encontrada.',

  // ── Email ─────────────────────────────────────────────────────────────────────
  EMAIL_SEND_FAILED:
    'No se pudo enviar el correo. Intentá de nuevo más tarde.',

  // ── Zona horaria ──────────────────────────────────────────────────────────────
  TIMEZONE_INVALID:
    'La fecha y hora enviada tiene una zona horaria inválida.',

  // ── Logo ──────────────────────────────────────────────────────────────────────
  LOGO_TOO_LARGE:
    'El logo es demasiado grande (máximo {max_mb} MB).',
  LOGO_INVALID:
    'El archivo de logo no es válido.',
  LOGO_INVALID_FORMAT:
    'Formato de imagen no permitido. Formatos aceptados: {allowed}.',

  // ── GeoRef ────────────────────────────────────────────────────────────────────
  GEOREF_UNAVAILABLE:
    'El servicio de geolocalización no está disponible ahora. Intentá de nuevo.',
  GEOREF_NOT_FOUND:
    'Ubicación no encontrada. Revisá los datos ingresados.',
  GEOREF_LOCALIDAD_NOT_FOUND:
    'Localidad no encontrada. Revisá los datos ingresados.',
  GEOREF_DIRECCION_NOT_FOUND:
    'Dirección no encontrada. Intentá con otra calle o altura.',
  GEOREF_INVALID_RESPONSE:
    'El servicio de geolocalización devolvió una respuesta inesperada. Intentá de nuevo.',

  // ── Invitaciones ──────────────────────────────────────────────────────────────
  INVITATION_TOKEN_INVALID_EXPIRED:
    'El enlace de invitación no es válido o ha expirado.',
}

/**
 * Códigos cuyos mensajes contienen la palabra "sucursal" y deben mostrarse
 * como "empresa" cuando la empresa tiene una única sucursal activa.
 */
const CODIGOS_REEMPLAZAR_SUCURSAL = new Set([
  'EMPRESA_HAS_NO_SUCURSAL',
  'SUCURSAL_PROFESIONAL_WITH_TURNOS_CONFIRMADOS_OUT',
  'SUCURSAL_MIEMBRO_DELETE_WITH_TURNOS_CONFIRMADOS',
  'SUCURSAL_INVALID_SELF_REMOVAL',
  'SUCURSAL_ACCESS_RESOURCES_FORBIDDEN',
  'CLIENTE_ALREADY_EXISTS',
])

/**
 * Si el código está en CODIGOS_REEMPLAZAR_SUCURSAL y la empresa tiene una sola
 * sucursal activa, reemplaza "sucursal" → "empresa" en el mensaje preservando mayúsculas.
 */
export function aplicarReemplazoSucursalEmpresa(mensaje, codigo, cantidadSucursales) {
  if (!mensaje || cantidadSucursales !== 1) return mensaje
  if (!CODIGOS_REEMPLAZAR_SUCURSAL.has(codigo)) return mensaje
  return mensaje.replace(/sucursal/gi, (match) =>
    match[0] === match[0].toUpperCase() ? 'Empresa' : 'empresa'
  )
}

/**
 * Retorna el mensaje legible para un código de error del back.
 * Interpola las variables del metadata si el mensaje tiene placeholders {variable}.
 *
 * @param {string} code     - Código de error (ej: "AUTH_ERROR")
 * @param {object} metadata - Variables extra del back (ej: { nombre_empresa: "Peluquería Sol" })
 * @returns {string}
 */
export function getErrorMessage(code, metadata = {}) {
  const template = ERROR_MAP[code] ?? `Error inesperado (${code}). Intentá de nuevo.`
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = metadata[key]
    if (Array.isArray(val)) return val.join(', ')
    return val ?? `{${key}}`
  })
}

/**
 * Extrae el mensaje legible de un objeto de error lanzado por api.js.
 *
 * Formatos posibles del objeto:
 *   { code, metadata? }                              → DomainError / AppSystemError
 *   { code: "VALIDATION_ERROR", errors: [...] }      → RequestValidationError (Pydantic)
 *   { message }                                      → error generado en el front
 *
 * @param {object} errorObj
 * @returns {string}
 */
export function parseBackendError(errorObj) {
  if (!errorObj) return 'Error desconocido.'

  // Error generado en el front con mensaje directo
  if (errorObj.message && !errorObj.code) return errorObj.message

  // Error de validación Pydantic: mostrar el primer campo con error
  if (errorObj.code === 'VALIDATION_ERROR' && Array.isArray(errorObj.errors)) {
    const first = errorObj.errors[0]
    if (first) {
      const fieldMsg = getErrorMessage(first.code)
      return first.field ? `${first.field}: ${fieldMsg}` : fieldMsg
    }
    return getErrorMessage('VALIDATION_ERROR')
  }

  return getErrorMessage(errorObj.code, errorObj.metadata)
}
