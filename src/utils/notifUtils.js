// Utilidades para notificaciones: generación de texto y formato de tiempo.
// Los tipos y mensajes replican la lógica de constantes.py del back.

// Mapeo de roles a texto legible — mismo criterio que AceptarInvitacion
function getRolLabel(rol, cantidadSucursales) {
  if (rol === 'GERENTE_EMPRESA' && cantidadSucursales === 1) return 'Gerente'
  const labels = {
    PROPIETARIO:      'Propietario',
    GERENTE_EMPRESA:  'Gerente de Empresa',
    GERENTE_SUCURSAL: 'Gerente de Sucursal',
    EMPLEADO:         'Empleado',
  }
  return labels[rol] ?? rol
}

// Devuelve el título visible de una notificación según su tipo
export function getNotifTitle(tipo) {
  const titles = {
    TURNO_NUEVO_USUARIO:     'Turno confirmado',
    TURNO_NUEVO_SUCURSAL:    'Nuevo turno',
    RECORDATORIO_USUARIO:    'Recordatorio de turno',
    MIEMBRO_NUEVO_EMPRESA:   'Nuevo miembro en empresa',
    MIEMBRO_NUEVO_SUCURSAL:  'Nuevo miembro en sucursal',
    TURNO_CANCELADO_USUARIO: 'Turno cancelado',
    TURNO_CANCELADO_SUCURSAL:'Turno cancelado',
  }
  return titles[tipo] ?? tipo
}

// Devuelve el cuerpo de texto de una notificación según tipo + extra_data.
// Replica la lógica de templates de constantes.py para determinar la variante correcta.
// cantidadSucursales: se pasa desde el contexto para mapear correctamente el rol de GERENTE_EMPRESA.
export function getNotifBody(tipo, extraData, cantidadSucursales) {
  const ed = extraData ?? {}

  switch (tipo) {
    case 'TURNO_NUEVO_USUARIO':
      return `${ed.nombre_empresa ?? '?'} te reservó un turno para ${ed.cuando ?? '?'}`

    case 'TURNO_CANCELADO_USUARIO':
      return `${ed.nombre_empresa ?? '?'} canceló tu turno para ${ed.cuando ?? '?'}`

    case 'RECORDATORIO_USUARIO':
      return `Recordatorio: tenés un turno en ${ed.nombre_empresa ?? '?'} para ${ed.cuando ?? '?'}`

    case 'MIEMBRO_NUEVO_EMPRESA':
      return `${ed.usuario_apellido ?? '?'}, ${ed.usuario_nombre ?? '?'} se unió a la empresa como ${getRolLabel(ed.rol, cantidadSucursales)}`

    case 'TURNO_NUEVO_SUCURSAL': {
      const hasNombreSucursal = !!ed.nombre_sucursal
      const isProfesional     = !!ed.profesional_id
      const cliente = `${ed.cliente_apellido ?? '?'}, ${ed.cliente_nombre ?? '?'}`
      if (hasNombreSucursal && isProfesional)
        return `El cliente ${cliente} reservó un turno con vos en la sucursal ${ed.nombre_sucursal} para ${ed.cuando ?? '?'}`
      if (hasNombreSucursal)
        return `El cliente ${cliente} reservó un turno en la sucursal ${ed.nombre_sucursal} para ${ed.cuando ?? '?'}`
      if (isProfesional)
        return `El cliente ${cliente} reservó un turno con vos para ${ed.cuando ?? '?'}`
      return `El cliente ${cliente} reservó un turno para ${ed.cuando ?? '?'}`
    }

    case 'TURNO_CANCELADO_SUCURSAL': {
      const hasNombreSucursal = !!ed.nombre_sucursal
      const isProfesional     = !!ed.profesional_id
      const cliente = `${ed.cliente_apellido ?? '?'}, ${ed.cliente_nombre ?? '?'}`
      if (hasNombreSucursal && isProfesional)
        return `El cliente ${cliente} canceló su turno con vos en la sucursal ${ed.nombre_sucursal} para ${ed.cuando ?? '?'}`
      if (hasNombreSucursal)
        return `El cliente ${cliente} canceló su turno en la sucursal ${ed.nombre_sucursal} para ${ed.cuando ?? '?'}`
      if (isProfesional)
        return `El cliente ${cliente} canceló su turno con vos para ${ed.cuando ?? '?'}`
      return `El cliente ${cliente} canceló su turno para ${ed.cuando ?? '?'}`
    }

    case 'MIEMBRO_NUEVO_SUCURSAL': {
      const miembro = `${ed.usuario_apellido ?? '?'}, ${ed.usuario_nombre ?? '?'}`
      const rolLabel = getRolLabel(ed.rol, cantidadSucursales)
      if (ed.nombre_sucursal)
        return `${miembro} se unió a la sucursal ${ed.nombre_sucursal} como ${rolLabel}`
      return `${miembro} se unió a la sucursal como ${rolLabel}`
    }

    default:
      return tipo
  }
}

// Devuelve el ícono emoji según el tipo de notificación
export function getNotifIcon(tipo) {
  const icons = {
    TURNO_NUEVO_USUARIO:     '📅',
    TURNO_NUEVO_SUCURSAL:    '📅',
    RECORDATORIO_USUARIO:    '⏰',
    MIEMBRO_NUEVO_EMPRESA:   '👥',
    MIEMBRO_NUEVO_SUCURSAL:  '👥',
    TURNO_CANCELADO_USUARIO: '❌',
    TURNO_CANCELADO_SUCURSAL:'❌',
  }
  return icons[tipo] ?? '🔔'
}

// Devuelve el tiempo relativo en español para mostrar junto a la notificación
// Mismo formato que TurnoCard (calcularCountdown) pero con "hace" en vez de "falta/faltan"
export function formatNotifTime(isoString) {
  if (!isoString) return ''
  const diffMs   = Date.now() - new Date(isoString).getTime()
  const diffMin  = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias  = Math.floor(diffMs / 86400000)
  const diffAnios = Math.floor(diffDias / 365)

  if (diffAnios >= 1)  return diffAnios === 1 ? 'hace 1 año'    : `hace ${diffAnios} años`
  if (diffDias  >= 1)  return diffDias  === 1 ? 'hace 1 día'    : `hace ${diffDias} días`
  if (diffHoras >= 1)  return `hace ${diffHoras} hs`
  if (diffMin   >= 2)  return `hace ${diffMin} min`
  if (diffMin   >= 1)  return 'hace 1 minuto'
  return 'hace menos de un minuto'
}
