/**
 * Utilidades para formatear fechas y calcular tiempos de turnos.
 * Las fechas del back llegan como strings ISO 8601 en UTC (aware).
 * El navegador las convierte automáticamente a la hora local del usuario.
 */

/**
 * Retorna la versión activa hoy de un ServicioBase.
 * Prioridad: 1) vigente hoy, 2) más próxima a futuro, 3) más reciente del pasado.
 */
export function getVersionActiva(versiones) {
  if (!versiones || versiones.length === 0) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  // 1. Busca versión vigente hoy (vigente_desde <= hoy <= vigente_hasta o sin vencimiento)
  const activa = versiones.find(sv => {
    const desde = new Date(sv.vigente_desde + 'T00:00:00')
    const hasta  = sv.vigente_hasta ? new Date(sv.vigente_hasta + 'T23:59:59') : null
    return desde <= hoy && (hasta === null || hasta >= hoy)
  })
  if (activa) return activa
  // 2. Ninguna vigente hoy → la más próxima a futuro
  const futuras = versiones
    .filter(sv => new Date(sv.vigente_desde + 'T00:00:00') > hoy)
    .sort((a, b) => new Date(a.vigente_desde) - new Date(b.vigente_desde))
  if (futuras.length > 0) return futuras[0]
  // 3. Sin futuras → la más reciente del pasado
  return [...versiones].sort(
    (a, b) => new Date(b.vigente_desde) - new Date(a.vigente_desde)
  )[0]
}

// Formatea minutos de duración: <60 → "X min", ≥60 → "Xh" o "Xh Ymin"
export function formatDuracion(minutos) {
  if (!minutos) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  const partes = []
  if (h > 0) partes.push(`${h} ${h === 1 ? 'h' : 'hs'}`)
  if (m > 0) partes.push(`${m} min`)
  return partes.join(' ')
}

// Retorna DD/MM o DD/MM/YY cuando el año del turno difiere del año actual
export function formatFechaTurno(fechaISO) {
  if (!fechaISO) return ''
  const fecha = new Date(fechaISO)
  const dd = String(fecha.getDate()).padStart(2, '0')
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const yy = String(fecha.getFullYear()).slice(-2)

  if (fecha.getFullYear() !== new Date().getFullYear()) return `${dd}/${mm}/${yy}`

  return `${dd}/${mm}`
}

// Retorna HH:MM en hora local
export function formatHoraTurno(fechaISO) {
  if (!fechaISO) return ''
  const fecha = new Date(fechaISO)
  const hh = String(fecha.getHours()).padStart(2, '0')
  const min = String(fecha.getMinutes()).padStart(2, '0')
  return `${hh}:${min}`
}

// Retorna "X días", "X horas" o "X min" dependiendo del tiempo restante.
// Retorna null si el turno ya pasó.
export function formatCountdown(fechaISO) {
  if (!fechaISO) return null
  const fecha = new Date(fechaISO)
  const diffMs = fecha - Date.now()
  if (diffMs <= 0) return null

  const diffMin  = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias  = Math.floor(diffMs / 86400000)

  if (diffMs > 24 * 3600000) {
    return `${diffDias} día${diffDias !== 1 ? 's' : ''}`
  } else if (diffMs > 3600000) {
    return `${diffHoras} hora${diffHoras !== 1 ? 's' : ''}`
  } else {
    return `${diffMin} min`
  }
}

// Retorna fecha completa local para mostrar en el detalle del turno
// Ej: "Viernes 28 de marzo de 2026 a las 10:30 hs"
export function formatFechaCompleta(fechaISO) {
  if (!fechaISO) return ''
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' a las ' + formatHoraTurno(fechaISO) + ' hs'
}

// Retorna la etiqueta legible de un estado de turno
// "VENCIDO" es un estado exclusivo del front: CONFIRMADO pero ya pasó el horario + duración
export function labelEstado(estado) {
  const labels = {
    CONFIRMADO:            'Confirmado',
    CANCELADO_POR_USUARIO: 'Cancelado por usuario',
    CANCELADO_POR_EMPRESA: 'Cancelado por empresa',
    CUMPLIDO:              'Cumplido',
    NO_CUMPLIDO:           'No cumplido',
    VENCIDO:               'Vencido',
    EN_HORA:               'En hora',
  }
  return labels[estado] || estado
}

// Retorna el nombre del día de la semana en español con inicial mayúscula
// Ej: "Lunes"
export function formatDiaSemana(fechaISO) {
  if (!fechaISO) return ''
  const fecha = new Date(fechaISO)
  return fecha.toLocaleDateString('es-AR', { weekday: 'long' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

// Retorna las opciones de recordatorio con su etiqueta
export function opcionesRecordatorio() {
  const opciones = [
    { value: 30,   label: '30 minutos antes' },
    { value: 60,   label: '1 hora antes' },
    { value: 120,  label: '2 horas antes' },
    { value: 180,  label: '3 horas antes' },
    { value: 360,  label: '6 horas antes' },
    { value: 720,  label: '12 horas antes' },
    { value: 1440, label: '1 día antes' },
  ]
  return opciones
}

/**
 * Formatea la dirección con cortes en cascada para que entre en una sola línea.
 * 1. Intenta mostrar: calle, localidad, departamento, provincia
 * 2. Si supera el límite de caracteres, quita la provincia
 * 3. Si sigue siendo largo, quita también el departamento
 * El límite es aproximado al ancho disponible en mobile (~45 chars).
 */
export function formatDireccionCascade(dir, limite = 45) {
  if (!dir) return ''
  const base     = [dir.calle, dir.altura].filter(Boolean).join(' ')
  const depto    = dir.departamento !== dir.localidad ? dir.departamento : null
  const conTodo  = [base, dir.localidad, depto, dir.provincia].filter(Boolean).join(', ')
  const sinProv  = [base, dir.localidad, depto].filter(Boolean).join(', ')
  const sinDepto = [base, dir.localidad].filter(Boolean).join(', ')
  if (conTodo.length  <= limite) return conTodo
  if (sinProv.length  <= limite) return sinProv
  return sinDepto
}
