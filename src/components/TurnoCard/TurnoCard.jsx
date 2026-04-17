import { useRef, useEffect } from 'react'
import { formatDiaSemana, formatFechaTurno, formatHoraTurno, labelEstado } from '../../utils/dateUtils'
import './TurnoCard.css'

/**
 * Tarjeta resumen de un turno.
 *
 * Estados virtuales (solo front, en back siguen siendo CONFIRMADO):
 *   EN_HORA  — ahora está dentro del rango [fecha_hora, fecha_hora + duracion)
 *   VENCIDO  — ahora superó fecha_hora + duracion
 *
 * Para CONFIRMADO real muestra una cuenta regresiva entre paréntesis.
 */
function calcularCountdown(diffMs) {
  if (diffMs <= 0) return null

  const diffMin   = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias  = Math.floor(diffMs / 86400000)
  const diffAnios = Math.floor(diffDias / 365)

  if (diffAnios >= 1)  return diffAnios === 1 ? 'falta 1 año' : `faltan ${diffAnios} años`
  if (diffDias >= 1)   return diffDias === 1 ? 'falta 1 día' : `faltan ${diffDias} días`
  if (diffHoras >= 1)  return `faltan ${diffHoras} hs`
  if (diffMin >= 2)    return `faltan ${diffMin} min`
  if (diffMin >= 1)    return 'falta 1 minuto'
  return 'falta menos de un minuto'
}

export default function TurnoCard({ turno, onSelect }) {
  const dia   = formatDiaSemana(turno.fecha_hora)
  const fecha = formatFechaTurno(turno.fecha_hora)
  const hora  = formatHoraTurno(turno.fecha_hora)

  // Ref para reducir el font-size del datetime si desborda el espacio disponible
  const datetimeRef = useRef(null)

  const ahora       = Date.now()
  const inicioTurno = new Date(turno.fecha_hora).getTime()
  const finTurno    = inicioTurno + turno.duracion * 60 * 1000

  // Determina estado visible
  let estadoVisible = turno.estado_turno
  if (turno.estado_turno === 'CONFIRMADO') {
    if (ahora >= finTurno)    estadoVisible = 'VENCIDO'
    else if (ahora >= inicioTurno) estadoVisible = 'EN_HORA'
  }

  // Cuenta regresiva solo para CONFIRMADO real (futuro)
  const countdown = estadoVisible === 'CONFIRMADO'
    ? calcularCountdown(inicioTurno - ahora)
    : null

  // Reduce font-size del datetime hasta que entre en el espacio asignado
  useEffect(() => {
    const el = datetimeRef.current
    if (!el) return
    el.style.fontSize = '' // resetea al valor CSS base (14px)
    let fs = parseFloat(window.getComputedStyle(el).fontSize)
    while (el.scrollWidth > el.clientWidth && fs > 1) {
      fs -= 0.5
      el.style.fontSize = fs + 'px'
    }
  }, [dia, fecha, hora, countdown, estadoVisible])

  const estadoClass = {
    CONFIRMADO:            'tcard__badge--confirmado',
    EN_HORA:               'tcard__badge--en-hora',
    CANCELADO_POR_USUARIO: 'tcard__badge--cancelado',
    CANCELADO_POR_EMPRESA: 'tcard__badge--cancelado',
    CUMPLIDO:              'tcard__badge--cumplido',
    NO_CUMPLIDO:           'tcard__badge--no-cumplido',
    VENCIDO:               'tcard__badge--vencido',
  }[estadoVisible] || 'tcard__badge--confirmado'

  return (
    <article
      className="tcard"
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      aria-label={`Turno en ${turno.sucursal}, ${dia} ${fecha} a las ${hora}`}
    >
      {/* Fila 1: día · fecha · hora */}
      <div className="tcard__top">
        <div className="tcard__datetime" ref={datetimeRef}>
          <span className="tcard__dia">{dia}</span>
          <span className="tcard__fecha-hora">
            {fecha} · {hora} hs
            {countdown && <span className="tcard__countdown"> ({countdown})</span>}
          </span>
        </div>
      </div>

      {/* Fila 2: logo · nombre empresa / servicio  +  badge */}
      <div className="tcard__bottom">
        <div className="tcard__logo">
          {turno.logo_empresa_url
            ? <img src={turno.logo_empresa_url} alt={turno.sucursal} loading="lazy" />
            : <span>{turno.sucursal.charAt(0)}</span>}
        </div>
        <div className="tcard__info">
          <span className="tcard__nombre"><span>{turno.sucursal}</span></span>
          <span className="tcard__servicio">
            <span className="tcard__servicio-emoji">✂️</span>
            <span className="tcard__servicio-nombre">{turno.nombre_de_servicio}</span>
          </span>
        </div>
        <span className={`tcard__badge ${estadoClass}`}>
          {labelEstado(estadoVisible)}
        </span>
      </div>
    </article>
  )
}
