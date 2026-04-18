import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usuarioService } from '../../services/usuarioService'
import { sucursalService } from '../../services/sucursalService'
import { formatDireccionCascade, formatDuracion, getVersionActiva } from '../../utils/dateUtils'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import BookingRow from '../../components/BookingRow/BookingRow'
import './PerfilSucursal.css'

// ─────────────────────────────────────────────────────────────────
// Constantes de localización
// ─────────────────────────────────────────────────────────────────

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
// JS Date.getDay() → Dom=0 … Sáb=6
const STRIP_DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const STAR_PTS    = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

// px por ítem del strip (ancho 58px + gap 8px)
const STRIP_STRIDE = 66

const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? '--'

// ─────────────────────────────────────────────────────────────────
// Helpers de fecha / tiempo
// ─────────────────────────────────────────────────────────────────

/** Formatea un Date local como DD/MM/YYYY */
function formatFecha(date) {
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`
}

/** JS getDay() Sun=0 → backend Mon=0, Sun=6 */
function getDiaSemana(date) {
  return (date.getDay() + 6) % 7
}

/** Parsea "HH:MM:SS" o "HH:MM" a minutos desde medianoche */
function parseTimeToMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/** Versión activa de un servicio para una fecha dada */
function getVersionParaFecha(servicio, fecha) {
  const f = new Date(fecha); f.setHours(0, 0, 0, 0)
  return servicio.servicios.find(sv => {
    const desde = new Date(sv.vigente_desde + 'T00:00:00')
    const hasta  = sv.vigente_hasta ? new Date(sv.vigente_hasta + 'T23:59:59') : null
    return f >= desde && (hasta === null || f <= hasta)
  }) ?? null
}

/** Versión activa hoy */
function getVersionHoy(servicio) {
  return getVersionParaFecha(servicio, new Date())
}

/**
 * Detecta si hay una versión futura que cambia precio o duración.
 * Retorna { desde, duracionActual, duracionFutura, precioActual, precioFuturo } o null.
 */
function getVersionChange(servicio) {
  if (servicio.servicios.length < 2) return null
  const sorted = [...servicio.servicios].sort(
    (a, b) => new Date(a.vigente_desde) - new Date(b.vigente_desde)
  )
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const futuro = sorted.find(sv => new Date(sv.vigente_desde + 'T00:00:00') > hoy)
  if (!futuro) return null
  const actual = getVersionHoy(servicio) ?? sorted[0]
  return {
    desde:          futuro.vigente_desde,
    duracionActual: actual.duracion,
    duracionFutura: futuro.duracion,
    precioActual:   Number(actual.precio),
    precioFuturo:   Number(futuro.precio),
  }
}

/** ¿Una fecha tiene disponibilidad según su versión activa? */
function fechaTieneDisponibilidad(servicio, fecha) {
  const version = getVersionParaFecha(servicio, fecha)
  if (!version) return false
  return version.disponibilidades.some(d => d.dia === getDiaSemana(fecha))
}

/**
 * Estado de un día.
 * Retorna: 'pasado' | 'fuera' | 'sin-disp' | 'disponible'
 *          | { status: 'excepcion', motivo: string|null }
 */
function getDayStatus(servicio, fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f   = new Date(fecha); f.setHours(0, 0, 0, 0)

  if (f < hoy) return 'pasado'

  if (servicio.limite_dias_reserva != null) {
    const limite = new Date(hoy.getTime() + servicio.limite_dias_reserva * 86400000)
    if (f > limite) return 'fuera'
  }

  const exc = servicio.excepciones_fechas.find(e => {
    const ini = new Date(e.fecha_inicio + 'T00:00:00')
    const fin = new Date(e.fecha_fin + 'T23:59:59')
    return f >= ini && f <= fin
  })
  if (exc) return { status: 'excepcion', motivo: exc.motivo ?? null }

  if (!fechaTieneDisponibilidad(servicio, f)) return 'sin-disp'
  return 'disponible'
}

/** Devuelve el primer día disponible desde hoy */
function findFirstAvailableDate(servicio) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const max = servicio.limite_dias_reserva ?? 1460
  for (let i = 0; i <= max; i++) {
    const d = new Date(hoy.getTime() + i * 86400000)
    if (getDayStatus(servicio, d) === 'disponible') return d
  }
  return null
}

/**
 * Genera todos los slots horarios para una fecha dada.
 * allServicios: lista completa de servicios de la sucursal; se usa para detectar
 * solapamiento con turnos del mismo profesional en otros servicios.
 * Retorna array de { label, fechaHora, bloqueado, version }.
 */
function calcularSlots(servicio, fecha, allServicios = []) {
  // Siempre trabajamos con medianoche local para evitar que setHours desborde al día siguiente
  const fechaBase = new Date(fecha)
  fechaBase.setHours(0, 0, 0, 0)

  const version = getVersionParaFecha(servicio, fechaBase)
  if (!version) return []

  const diaSemana = getDiaSemana(fechaBase)
  const disps = version.disponibilidades.filter(d => d.dia === diaSemana)
  if (!disps.length) return []

  const ahora = new Date()
  const slots  = []

  // Turnos de otros servicios del mismo profesional (solapamiento inter-servicio)
  const turnosConflicto = servicio.profesional_id != null
    ? allServicios
        .filter(s => s.id !== servicio.id && s.profesional_id === servicio.profesional_id)
        .flatMap(s => s.turnos_actuales)
    : []

  for (const disp of disps) {
    const inicio  = parseTimeToMin(disp.hora_inicio)
    // "00:00" en hora_fin representa medianoche final (24:00), no inicio del día
    const rawFin  = parseTimeToMin(disp.hora_fin)
    const fin     = Math.min(rawFin === 0 ? 24 * 60 : rawFin, 23 * 60 + 55)

    for (let t = inicio; t <= fin; t += disp.intervalo) {
      const slotDate = new Date(fechaBase)   // copia de medianoche del día correcto
      slotDate.setHours(Math.floor(t / 60), t % 60, 0, 0)
      // Guarda de seguridad: si setHours movió el slot al día siguiente, lo descartamos
      if (slotDate.toDateString() !== fechaBase.toDateString()) continue
      const slotEnd  = new Date(slotDate.getTime() + version.duracion * 60000)

      // Solapamiento con turnos propios del servicio
      const supPropios = servicio.turnos_actuales.filter(tu => {
        const ts = new Date(tu.fecha_hora)
        const te = new Date(ts.getTime() + tu.duracion * 60000)
        return slotDate < te && slotEnd > ts
      })

      // Solapamiento con turnos del mismo profesional en otros servicios
      const supConflicto = turnosConflicto.filter(tu => {
        const ts = new Date(tu.fecha_hora)
        const te = new Date(ts.getTime() + tu.duracion * 60000)
        return slotDate < te && slotEnd > ts
      })

      slots.push({
        label:     `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
        fechaHora: slotDate,
        bloqueado: slotDate <= ahora
                || supPropios.length >= disp.cant_turnos_max
                || supConflicto.length > 0,
        version,
      })
    }
  }

  // Ordenar por hora para que múltiples disponibilidades no queden intercaladas
  return slots.sort((a, b) => a.fechaHora - b.fechaHora)
}

/** Verifica si todos los servicios del grupo son intercambiables (misma aclaracion, duración y precio activos) */
function puedeElegirCualquiera(entries) {
  if (entries.length <= 1) return false
  const versionsHoy = entries.map(e => getVersionActiva(e.servicios))
  if (versionsHoy.some(v => !v)) return false
  const acl0    = entries[0].aclaracion ?? null
  const dur0    = versionsHoy[0].duracion
  const precio0 = Number(versionsHoy[0].precio)
  return entries.every((e, i) => {
    const v = versionsHoy[i]
    return (e.aclaracion ?? null) === acl0 && v.duracion === dur0 && Number(v.precio) === precio0
  })
}

/** Primer día disponible considerando la unión de disponibilidades de todos los servicios del grupo */
function findFirstAvailableDateMulti(serviciosGrupo) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const max = Math.max(...serviciosGrupo.map(s => s.limite_dias_reserva ?? 1460))
  for (let i = 0; i <= max; i++) {
    const d = new Date(hoy.getTime() + i * 86400000)
    if (serviciosGrupo.some(s => getDayStatus(s, d) === 'disponible')) return d
  }
  return null
}

/**
 * Slots unión: para cada horario, disponible si al menos un servicio del grupo lo tiene libre.
 * Cada slot incluye `opciones`: array de versioned-service IDs disponibles para ese horario.
 */
function calcularSlotsUnion(serviciosGrupo, fecha, allServicios) {
  const slotMap = new Map()
  for (const servicio of serviciosGrupo) {
    for (const slot of calcularSlots(servicio, fecha, allServicios)) {
      if (!slotMap.has(slot.label)) {
        slotMap.set(slot.label, {
          ...slot,
          opciones: slot.bloqueado ? [] : [slot.version.id],
        })
      } else {
        const existing = slotMap.get(slot.label)
        if (!slot.bloqueado) {
          existing.bloqueado = false
          if (!existing.opciones.includes(slot.version.id)) existing.opciones.push(slot.version.id)
        }
      }
    }
  }
  return [...slotMap.values()].sort((a, b) => a.fechaHora - b.fechaHora)
}

// ─────────────────────────────────────────────────────────────────
// Sub-componente: franja horizontal de fechas (DateStrip)
// ─────────────────────────────────────────────────────────────────

function DateStrip({ servicio, serviciosGrupo, selectedFecha, onSelectFecha, onExcepcion }) {
  const stripRef  = useRef(null)
  const today     = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const [visibleMonth,    setVisibleMonth]    = useState(today.getMonth())
  const [visibleYear,     setVisibleYear]     = useState(today.getFullYear())
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear,      setPickerYear]      = useState(today.getFullYear())
  const [tooltip,         setTooltip]         = useState(null)

  // Genera todas las fechas de hoy hasta el límite de reserva (o el máximo del grupo)
  const dates = useMemo(() => {
    const max = serviciosGrupo
      ? Math.max(...serviciosGrupo.map(s => s.limite_dias_reserva ?? 1460))
      : (servicio.limite_dias_reserva ?? 1460)
    return Array.from({ length: max + 1 }, (_, i) => new Date(today.getTime() + i * 86400000))
  }, [servicio, serviciosGrupo, today])

  // Estado calculado de cada fecha — en modo unión: disponible si algún servicio del grupo lo está
  const statuses = useMemo(() => {
    if (serviciosGrupo) {
      return dates.map(d => {
        const statusList = serviciosGrupo.map(s => getDayStatus(s, d))
        if (statusList.some(s => (typeof s === 'string' ? s : s?.status) === 'disponible')) return 'disponible'
        const exc = statusList.find(s => typeof s === 'object' && s?.status === 'excepcion')
        if (exc) return exc
        return statusList[0]
      })
    }
    return dates.map(d => getDayStatus(servicio, d))
  }, [dates, servicio, serviciosGrupo])

  // Meses disponibles en el strip para el picker
  const availableMonths = useMemo(() => {
    const seen = new Set()
    return dates.reduce((acc, d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!seen.has(key)) { seen.add(key); acc.push({ year: d.getFullYear(), month: d.getMonth() }) }
      return acc
    }, [])
  }, [dates])

  // Años que aparecen en el picker, con los 12 meses — se deshabilitan los no disponibles
  const pickerYears = useMemo(() => {
    const availableSet = new Set(availableMonths.map(({ year, month }) => `${year}-${month}`))
    const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => a - b)
    return years.map(year => ({
      year,
      months: Array.from({ length: 12 }, (_, month) => ({
        month,
        available: availableSet.has(`${year}-${month}`),
      })),
    }))
  }, [availableMonths])

  const multiYear = pickerYears.length > 1

  // Scroll a un índice concreto
  const scrollToIdx = useCallback((idx) => {
    stripRef.current?.scrollTo({ left: Math.max(0, idx * STRIP_STRIDE), behavior: 'smooth' })
  }, [])

  // Al cambiar la fecha seleccionada, centrarla en la vista
  useEffect(() => {
    if (!selectedFecha) return
    const idx = dates.findIndex(d => d.toDateString() === selectedFecha.toDateString())
    if (idx >= 0) scrollToIdx(idx)
  }, [selectedFecha, dates, scrollToIdx])

  // Actualiza el mes/año visible al hacer scroll
  const handleScroll = useCallback(() => {
    if (!stripRef.current) return
    const idx = Math.round(stripRef.current.scrollLeft / STRIP_STRIDE)
    const d = dates[Math.min(idx, dates.length - 1)]
    if (d) { setVisibleMonth(d.getMonth()); setVisibleYear(d.getFullYear()) }
  }, [dates])

  // Flechas de un día
  const goLeft  = () => stripRef.current?.scrollBy({ left: -STRIP_STRIDE, behavior: 'smooth' })
  const goRight = () => stripRef.current?.scrollBy({ left:  STRIP_STRIDE, behavior: 'smooth' })

  // Arrastre horizontal: listener nativo en el elemento del strip para capturar
  // eventos desde cualquier punto, incluyendo botones disabled (el bubbling nativo
  // llega al div independientemente del sistema de eventos de React).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return

    let hasDragged = false

    const onMouseDown = (e) => {
      if (e.button !== 0) return
      const startX      = e.pageX
      const startScroll = el.scrollLeft
      hasDragged = false

      const onMove = (ev) => {
        const dx = ev.pageX - startX
        if (Math.abs(dx) > 4) hasDragged = true
        el.scrollLeft = startScroll - dx
      }
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup',   onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup',   onUp)
    }

    // Intercepta el click en fase de captura: si hubo arrastre lo cancela
    // antes de que llegue al onClick de cualquier botón hijo de React.
    const onClickCapture = (e) => {
      if (hasDragged) { e.stopPropagation(); e.preventDefault(); hasDragged = false }
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('click', onClickCapture, { capture: true })
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('click', onClickCapture, { capture: true })
    }
  }, [])

  // Picker: salta al primer día disponible del mes seleccionado
  const handlePickMonth = (year, month) => {
    setMonthPickerOpen(false)
    // Busca el primer día disponible de ese mes
    const idx = dates.findIndex((d, i) => {
      if (d.getFullYear() !== year || d.getMonth() !== month) return false
      const s = statuses[i]
      return (typeof s === 'string' ? s : s?.status) === 'disponible'
    })
    // Fallback: primer día del mes aunque no tenga disponibilidad
    const fallback = dates.findIndex(d => d.getFullYear() === year && d.getMonth() === month)
    scrollToIdx(idx >= 0 ? idx : fallback)
  }

  // Cierra el picker al hacer click fuera
  useEffect(() => {
    if (!monthPickerOpen) return
    const close = () => setMonthPickerOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [monthPickerOpen])

  return (
    <div className="ps-strip-wrapper">

      {/* Mes/año centrado */}
      <div className="ps-strip-month-row">
        <div className="ps-strip-header__month">
          <button
            className="ps-strip-month-btn"
            type="button"
            onClick={(e) => { e.stopPropagation(); setPickerYear(visibleYear); setMonthPickerOpen(o => !o) }}
          >
            <span>{MESES[visibleMonth]} {visibleYear}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {monthPickerOpen && (() => {
            const currentGroup = pickerYears.find(g => g.year === pickerYear) ?? { year: pickerYear, months: Array.from({ length: 12 }, (_, m) => ({ month: m, available: false })) }
            const minYear = pickerYears[0]?.year ?? pickerYear
            const maxYear = pickerYears[pickerYears.length - 1]?.year ?? pickerYear
            return (
              <div className="ps-month-picker" onClick={e => e.stopPropagation()}>
                {/* Navegación de año */}
                <div className="ps-month-picker__year-nav">
                  <button
                    className="ps-month-picker__year-arrow"
                    type="button"
                    onClick={() => setPickerYear(y => Math.max(minYear, y - 1))}
                    disabled={pickerYear <= minYear}
                    aria-label="Año anterior"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <span className="ps-month-picker__year-title">{pickerYear}</span>
                  <button
                    className="ps-month-picker__year-arrow"
                    type="button"
                    onClick={() => setPickerYear(y => Math.min(maxYear, y + 1))}
                    disabled={pickerYear >= maxYear}
                    aria-label="Año siguiente"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
                {/* Grilla 3×4 de meses */}
                <div className="ps-month-picker__grid">
                  {currentGroup.months.map(({ month, available }) => (
                    <button
                      key={month}
                      className={`ps-month-picker__item${!available ? ' ps-month-picker__item--disabled' : ''}${month === visibleMonth && pickerYear === visibleYear ? ' ps-month-picker__item--active' : ''}`}
                      onClick={() => available && handlePickMonth(pickerYear, month)}
                      type="button"
                      disabled={!available}
                    >
                      {MESES_CORTO[month]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Contenedor con flechas absolutas a los costados y strip con padding reservado */}
      <div className="ps-strip-outer">
        <button className="ps-strip-arrow ps-strip-arrow--left" type="button" onClick={goLeft} aria-label="Día anterior">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div
          className="ps-strip"
          ref={stripRef}
          onScroll={handleScroll}
        >
          {dates.map((date, i) => {
            const status    = statuses[i]
            const statusStr = typeof status === 'object' ? status.status : status
            const motivo    = typeof status === 'object' ? status.motivo : null
            const isSelected = selectedFecha?.toDateString() === date.toDateString()
            const isToday    = date.toDateString() === today.toDateString()
            return (
              <button
                key={i}
                type="button"
                className={[
                  'ps-strip-day',
                  `ps-strip-day--${statusStr}`,
                  isSelected ? 'ps-strip-day--selected' : '',
                  isToday    ? 'ps-strip-day--today'    : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  // No usar disabled HTML para no bloquear el mousedown del drag
                  if (statusStr === 'excepcion') { onExcepcion(motivo); return }
                  if (statusStr !== 'disponible') return
                  onSelectFecha(isSelected ? null : date)
                }}
                onMouseEnter={(e) => {
                  if (statusStr === 'excepcion' && motivo) {
                    setTooltip({ motivo, rect: e.currentTarget.getBoundingClientRect() })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                aria-label={`${formatFecha(date)}${statusStr === 'excepcion' ? ' - bloqueado' : ''}`}
                aria-pressed={isSelected || undefined}
              >
                <span className="ps-strip-day__dow">{STRIP_DAYS[date.getDay()]}</span>
                <span className="ps-strip-day__num">{date.getDate()}</span>
                <span className="ps-strip-day__mes">{MESES_CORTO[date.getMonth()]}</span>
              </button>
            )
          })}
        </div>

        <button className="ps-strip-arrow ps-strip-arrow--right" type="button" onClick={goRight} aria-label="Día siguiente">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Tooltip de excepción (solo en desktop con hover) */}
      {tooltip && (
        <div
          className="ps-strip-tooltip"
          style={{
            left: `${tooltip.rect.left + tooltip.rect.width / 2}px`,
            top:  `${tooltip.rect.top - 8}px`,
          }}
        >
          {tooltip.motivo}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-componente: calificación en estrellas
// ─────────────────────────────────────────────────────────────────

function StarRating({ value }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const p = i + 1
    if (value >= p)        return 'full'
    if (value >= p - 0.5) return 'half'
    return 'empty'
  })
  return (
    <div className="ps-stars">
      {stars.map((type, i) => (
        <svg key={i} className={`ps-star ps-star--${type}`} viewBox="0 0 24 24" aria-hidden="true">
          {type === 'half' && (
            <defs>
              <clipPath id={`ps-clip-${i}`}>
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
          )}
          {type !== 'half'
            ? <polygon points={STAR_PTS}
                fill={type === 'full' ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.5" />
            : <>
                <polygon points={STAR_PTS} fill="none" stroke="currentColor" strokeWidth="1.5" />
                <polygon points={STAR_PTS} fill="currentColor" stroke="none"
                  clipPath={`url(#ps-clip-${i})`} />
              </>
          }
        </svg>
      ))}
      <span className="ps-stars__num">{value.toFixed(1)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────

/**
 * Nombre del profesional con font adaptable: empieza en 14px, achica hasta
 * 11px si desborda el contenedor y luego aplica ellipsis por CSS.
 */
function ProfNombre({ nombre }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let size = 15
    el.style.fontSize = size + 'px'
    while (el.scrollWidth > el.offsetWidth && size > 11) {
      size -= 0.5
      el.style.fontSize = size + 'px'
    }
  })
  return <span className="ps-servicio-card__nombre" ref={ref}>{nombre}</span>
}

// Fila de profesional en el header de reserva con font-size adaptable (16→12px) + ellipsis
function ProfReservaLabel({ nombre, apellido, dni }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let fs = 16
    el.style.fontSize = `${fs}px`
    while (el.scrollWidth > el.offsetWidth && fs > 12) {
      fs -= 0.5
      el.style.fontSize = `${fs}px`
    }
  })
  return (
    <span className="ps-reserva-row ps-reserva-prof-row" ref={ref}>
      <span className="ps-meta-icon" aria-hidden="true">💼</span>
      <span className="ps-meta-label">Profesional:</span>
      <span className="ps-meta-value ps-reserva-prof-val">
        {apellido}, {nombre}{dni ? ` (DNI ${formatDni(dni)})` : ''}
      </span>
    </span>
  )
}

export default function PerfilSucursal() {
  const { id: sucursalId } = useParams()
  const navigate           = useNavigate()
  const location           = useLocation()
  const { user, updateUser } = useAuth()

  // Datos de la sucursal: desde state de navegación o desde favoritos del usuario
  const sucursal = useMemo(() => {
    if (location.state?.sucursal) return location.state.sucursal
    return user?.favoritos?.find(f => String(f.id) === sucursalId) ?? null
  }, [location.state, user?.favoritos, sucursalId])

  const [servicios,  setServicios]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [backError,  setBackError]  = useState(null)

  // ── Favorito
  const [isFavorito, setIsFavorito] = useState(
    () => (user?.favoritos ?? []).some(f => String(f.id) === sucursalId)
  )

  const handleToggleFavorito = useCallback(async () => {
    const prev = isFavorito
    setIsFavorito(!prev)
    try {
      if (prev) {
        await usuarioService.deleteFavorito(Number(sucursalId))
        updateUser({ favoritos: (user?.favoritos ?? []).filter(f => f.id !== Number(sucursalId)) })
      } else {
        const suc = await usuarioService.addFavorito(Number(sucursalId))
        updateUser({ favoritos: [...(user?.favoritos ?? []), suc] })
      }
    } catch (err) {
      setIsFavorito(prev)
      setBackError(err)
    }
  }, [isFavorito, sucursalId, user?.favoritos, updateUser])

  // ── Flujo de reserva
  const [step,                  setStep]                  = useState('servicios')
  const [selectedNombre,        setSelectedNombre]        = useState(null)
  const [selectedServicio,      setSelectedServicio]      = useState(null)
  const [selectedFecha,         setSelectedFecha]         = useState(null)
  const [selectedSlot,          setSelectedSlot]          = useState(null)
  const [cualquieraProfesional, setCualquieraProfesional] = useState(false)
  const [selectedGrupo,         setSelectedGrupo]         = useState([])

  // ── Modales
  const [excepcionInfo, setExcepcionInfo] = useState(null)
  const [reservando,    setReservando]    = useState(false)
  const [exito,         setExito]         = useState(false)
  const [bookingOpen,   setBookingOpen]   = useState(false)

  // ── Shrink del nombre del servicio en el paso reserva
  const nombreRef = useRef(null)
  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    // Reinicia al tamaño máximo antes de medir
    el.style.fontSize = ''
    const MAX_FS = 22
    const MIN_FS = 13
    let fs = MAX_FS
    // offsetWidth del h3 = ancho real del texto (flex align-items:center lo encoge al contenido)
    // clientWidth del padre = espacio disponible en la columna del grid
    const available = el.parentElement?.clientWidth ?? 0
    while (el.offsetWidth > available && fs > MIN_FS) {
      fs -= 1
      el.style.fontSize = `${fs}px`
    }
  }, [selectedServicio])

  // Redirige si no hay datos de sucursal
  useEffect(() => {
    if (!loading && !sucursal) navigate('/home', { replace: true })
  }, [sucursal, loading, navigate])

  // Carga los servicios al montar
  useEffect(() => {
    if (!sucursalId) return
    setLoading(true)
    sucursalService.getServiciosParaReserva(sucursalId, true)
      .then(data => setServicios(data))
      .catch(err  => setBackError(err))
      .finally(()  => setLoading(false))
  }, [sucursalId])

  // Agrupa servicios por nombre (muestra 1 card por nombre)
  const serviciosByNombre = useMemo(() => {
    const map = {}
    servicios.forEach(s => {
      if (!map[s.nombre]) map[s.nombre] = []
      map[s.nombre].push(s)
    })
    return map
  }, [servicios])

  // Slots calculados para la fecha seleccionada — unión si el usuario eligió cualquier profesional
  const slots = useMemo(() => {
    if (!selectedServicio || !selectedFecha) return []
    if (cualquieraProfesional && selectedGrupo.length > 0)
      return calcularSlotsUnion(selectedGrupo, selectedFecha, servicios)
    return calcularSlots(selectedServicio, selectedFecha, servicios)
  }, [selectedServicio, selectedFecha, servicios, cualquieraProfesional, selectedGrupo])

  // ── Handlers de navegación del flujo ──

  const handleSelectNombre = (nombre) => {
    const entries = serviciosByNombre[nombre]
    setSelectedNombre(nombre)
    if (entries.length === 1) {
      setSelectedServicio(entries[0])
      setSelectedFecha(findFirstAvailableDate(entries[0]))
      setStep('reserva')
    } else {
      setStep('profesional')
    }
  }

  const handleSelectProfesional = (servicio) => {
    setSelectedServicio(servicio)
    setSelectedFecha(findFirstAvailableDate(servicio))
    setStep('reserva')
  }

  const handleSelectCualquiera = () => {
    const entries = serviciosByNombre[selectedNombre]
    setCualquieraProfesional(true)
    setSelectedGrupo(entries)
    setSelectedServicio(entries[0])
    setSelectedFecha(findFirstAvailableDateMulti(entries))
    setStep('reserva')
  }

  const handleSelectFecha = (fecha) => {
    setSelectedFecha(fecha)
    setSelectedSlot(null)
  }

  const handleBack = () => {
    if (step === 'reserva') {
      const multipleProf = cualquieraProfesional || (serviciosByNombre[selectedServicio?.nombre]?.length ?? 0) > 1
      setSelectedFecha(null)
      setSelectedSlot(null)
      if (cualquieraProfesional) { setCualquieraProfesional(false); setSelectedGrupo([]) }
      if (multipleProf) {
        setStep('profesional')
      } else {
        setStep('servicios')
        setSelectedServicio(null)
        setSelectedNombre(null)
      }
    } else if (step === 'profesional') {
      setStep('servicios')
      setSelectedServicio(null)
      setSelectedNombre(null)
    }
  }

  const handleConfirmar = async () => {
    if (!selectedSlot || reservando) return
    setReservando(true)
    try {
      // En modo "cualquier profesional" se envían todas las versiones disponibles para ese slot
      const opciones = cualquieraProfesional && selectedSlot.opciones?.length > 0
        ? selectedSlot.opciones.map(id => ({
            sucursal_id: Number(sucursalId),
            servicio_id: id,
            fecha_hora:  selectedSlot.fechaHora.toISOString(),
          }))
        : [{
            sucursal_id: Number(sucursalId),
            servicio_id: selectedSlot.version.id,
            fecha_hora:  selectedSlot.fechaHora.toISOString(),
          }]
      await usuarioService.reservarTurno(opciones)
      // Inyectar el turno recién tomado para recalcular slots sin nuevo GET
      const nuevoTurno = { fecha_hora: selectedSlot.fechaHora.toISOString(), duracion: selectedSlot.version.duracion }
      if (cualquieraProfesional) {
        // No sabemos cuál profesional tomó el turno: se bloquea el slot en todos del grupo
        setServicios(prev => prev.map(s =>
          selectedGrupo.some(g => g.id === s.id)
            ? { ...s, turnos_actuales: [...s.turnos_actuales, nuevoTurno] }
            : s
        ))
        setSelectedGrupo(prev => prev.map(g => ({ ...g, turnos_actuales: [...g.turnos_actuales, nuevoTurno] })))
      } else {
        setServicios(prev => prev.map(s =>
          s.id === selectedServicio.id
            ? { ...s, turnos_actuales: [...s.turnos_actuales, nuevoTurno] }
            : s
        ))
      }
      setSelectedServicio(prev => ({ ...prev, turnos_actuales: [...prev.turnos_actuales, nuevoTurno] }))
      setExito(true)
    } catch (err) {
      setBackError(err)
    } finally {
      setReservando(false)
    }
  }

  const handleExitoClose = () => {
    setExito(false)
    setSelectedSlot(null)
  }

  // ── Render helpers ──

  const dir      = sucursal?.direccion
  const dirTexto = formatDireccionCascade(dir)
  const mapsUrl = dir?.lat != null && dir?.lng != null
    ? `https://www.google.com/maps?q=${dir.lat},${dir.lng}`
    : null

  const cal5 = sucursal?.calificacion != null
    ? Math.round((Number(sucursal.calificacion) / 2) * 10) / 10
    : null

  if (!sucursal) return null

  // ────────────────────────────────────────────────────────────────
  // JSX
  // ────────────────────────────────────────────────────────────────

  return (
    <div className="ps-page">

      {/* ═══ TOPBAR ═══ */}
      <AppTopBar
        left={
          <button className="hp-hamburger"
            onClick={() => navigate('/home', { state: { search: location.state?.search, resultados: location.state?.resultados } })}
            aria-label="Volver al inicio">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        }
        right={<UserTopBarRight />}
      />

      <div className="ps-body">

        {/* ── Cabecera de la sucursal: solo en pasos previos a la reserva ── */}
        {step !== 'reserva' && (
          <div className="ps-sucursal-header">
            <div className="ps-sucursal-logo">
              {sucursal.logo_url
                ? <img src={sucursal.logo_url} alt={sucursal.nombre} />
                : <span>{sucursal.nombre.charAt(0).toUpperCase()}</span>
              }
            </div>

            <div className="ps-sucursal-info">
              <h1 className="ps-sucursal-nombre">{sucursal.nombre}</h1>

              {cal5 != null && <StarRating value={cal5} />}

              {(sucursal.rubro || sucursal.rubro2) && (
                <p className="ps-sucursal-rubro">
                  {[sucursal.rubro, sucursal.rubro2].filter(Boolean).join(' · ')}
                </p>
              )}

              {dirTexto && (
                <p className="ps-sucursal-row">
                  <span className="ps-row-icon" aria-hidden="true">📍</span>
                  <span>{dirTexto}</span>
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      className="ps-maps-link" onClick={e => e.stopPropagation()}
                      aria-label="Ver en Google Maps">
                      <svg className="ps-maps-icon" viewBox="14.32 4.87961494 37.85626587 52.79038506" aria-hidden="true">
                        <path d="m37.34 7.82c-1.68-.53-3.48-.82-5.34-.82-5.43 0-10.29 2.45-13.54 6.31l8.35 7.02z" fill="#1a73e8"/>
                        <path d="m18.46 13.31a17.615 17.615 0 0 0 -4.14 11.36c0 3.32.66 6.02 1.75 8.43l10.74-12.77z" fill="#ea4335"/>
                        <path d="m32 17.92a6.764 6.764 0 0 1 5.16 11.13l10.52-12.51a17.684 17.684 0 0 0 -10.35-8.71l-10.51 12.51a6.74 6.74 0 0 1 5.18-2.42" fill="#4285f4"/>
                        <path d="m32 31.44c-3.73 0-6.76-3.03-6.76-6.76a6.7 6.7 0 0 1 1.58-4.34l-10.75 12.77c1.84 4.07 4.89 7.34 8.03 11.46l13.06-15.52a6.752 6.752 0 0 1 -5.16 2.39" fill="#fbbc04"/>
                        <path d="m36.9 48.8c5.9-9.22 12.77-13.41 12.77-24.13 0-2.94-.72-5.71-1.99-8.15l-23.57 28.05c1 1.31 2.01 2.7 2.99 4.24 3.58 5.54 2.59 8.86 4.9 8.86s1.32-3.33 4.9-8.87" fill="#34a853"/>
                      </svg>
                    </a>
                  )}
                </p>
              )}

              {dir?.aclaracion && (
                <p className="ps-sucursal-row">
                  <span className="ps-row-icon" aria-hidden="true">📝</span>
                  <span>{dir.aclaracion}</span>
                </p>
              )}

              {sucursal.telefonos?.length > 0 && (
                <p className="ps-sucursal-row">
                  <span className="ps-row-icon" aria-hidden="true">☎️</span>
                  {sucursal.telefonos.map(t => t.numero).join(' · ')}
                </p>
              )}

              {sucursal.email && (
                <p className="ps-sucursal-row">
                  <span className="ps-row-icon" aria-hidden="true">📧</span>
                  {sucursal.email}
                </p>
              )}
            </div>

            {/* Botón favorito */}
            <button
              className={`ps-fav-btn${isFavorito ? ' ps-fav-btn--on' : ''}`}
              onClick={handleToggleFavorito}
              aria-label={isFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              aria-pressed={isFavorito}
              type="button"
            >
              <svg width="22" height="22" viewBox="0 0 24 24"
                fill={isFavorito ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        )}


        {/* ══════════════════════════════════════════════════
            PASO 1 — Lista de servicios
        ══════════════════════════════════════════════════ */}
        {step === 'servicios' && (
          <div className="ps-section">
            <h2 className="ps-section__title">Servicios disponibles</h2>

            {loading && (
              <div className="ps-loading"><div className="spinner" /></div>
            )}

            {!loading && Object.keys(serviciosByNombre).length === 0 && (
              <p className="ps-empty">Esta sucursal no tiene servicios disponibles.</p>
            )}

            {!loading && (
              <div className="ps-servicios-list">
                {Object.entries(serviciosByNombre).map(([nombre, entries]) => {
                  const versionsHoy = entries
                    .map(e => getVersionActiva(e.servicios))
                    .filter(Boolean)

                  const duraciones  = [...new Set(versionsHoy.map(v => v.duracion))].sort((a, b) => a - b)
                  const precios     = [...new Set(versionsHoy.map(v => Number(v.precio)))].sort((a, b) => a - b)
                  const durLabel    = duraciones.length > 1
                    ? `${formatDuracion(duraciones[0])} – ${formatDuracion(duraciones[duraciones.length - 1])}`
                    : duraciones.length === 1 ? formatDuracion(duraciones[0]) : null
                  const precioLabel = precios.length > 1
                    ? `$${precios[0].toLocaleString('es-AR')} - $${precios[precios.length - 1].toLocaleString('es-AR')}`
                    : precios.length === 1 ? `$${precios[0].toLocaleString('es-AR')}` : null
                  const profMap     = new Map()
                  entries.filter(e => e.profesional_id).forEach(e => {
                    if (!profMap.has(e.profesional_id)) profMap.set(e.profesional_id, `${e.profesional_apellido}, ${e.profesional_nombre}`)
                  })
                  const profLabel   = profMap.size === 0 ? '--' : [...profMap.values()].join(' – ')

                  return (
                    <button key={nombre} className="ps-servicio-card"
                      onClick={() => handleSelectNombre(nombre)}>
                      <div className="ps-servicio-card__info">
                        <span className="ps-servicio-card__nombre">{nombre}</span>
                        {durLabel && (
                          <span className="ps-meta-item ps-meta-item--block">
                            <span className="ps-meta-icon" aria-hidden="true">⏱️</span>
                            <span className="ps-meta-label">Duración:</span>
                            <span className="ps-meta-value ps-meta-value--clip">{durLabel}</span>
                          </span>
                        )}
                        {precioLabel && (
                          <span className="ps-meta-item ps-meta-item--block">
                            <span className="ps-meta-icon ps-meta-icon--precio" aria-hidden="true">💲</span>
                            <span className="ps-meta-label">Precio:</span>
                            <span className="ps-meta-value ps-meta-value--clip">{precioLabel}</span>
                          </span>
                        )}
                        {profLabel && (
                          <span className="ps-meta-item ps-meta-item--block">
                            <span className="ps-meta-icon" aria-hidden="true">💼</span>
                            <span className="ps-meta-label">Profesional:</span>
                            <span className="ps-meta-value ps-meta-value--clip">{profLabel}</span>
                          </span>
                        )}
                      </div>
                      <svg className="ps-servicio-card__arrow" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PASO 2 — Selección de profesional
        ══════════════════════════════════════════════════ */}
        {step === 'profesional' && selectedNombre && (
          <div className="ps-section">
            <div className="ps-prof-header">
              <button className="ps-reserva-back" onClick={handleBack} aria-label="Volver">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div className="ps-reserva-titulo">
                <h2 className="ps-section__title">Elegí un profesional</h2>
                <p className="ps-section__sub">{selectedNombre}</p>
              </div>
              <div aria-hidden="true" />
            </div>

            {puedeElegirCualquiera(serviciosByNombre[selectedNombre]) && (
              <div className="ps-cualquiera-wrap">
                <button className="btn svc-btn-add" onClick={handleSelectCualquiera}>
                  Cualquier profesional
                </button>
              </div>
            )}

            <div className="ps-profesionales">
              {serviciosByNombre[selectedNombre].map(s => {
                const v = getVersionActiva(s.servicios)
                return (
                  <button key={s.id} className="ps-servicio-card"
                    onClick={() => handleSelectProfesional(s)}>
                    <div className="ps-servicio-card__info">
                      <ProfNombre nombre={s.profesional_id ? `${s.profesional_apellido}, ${s.profesional_nombre}` : '--'} />
                      <span className="ps-meta-item ps-meta-item--block">
                        <span className="ps-meta-icon ps-meta-icon--dni" aria-hidden="true">🪪</span>
                        <span className="ps-meta-label">DNI:</span>
                        <span className="ps-meta-value ps-meta-value--clip">{formatDni(s.profesional_dni)}</span>
                      </span>
                      {v && (
                        <>
                          <span className="ps-meta-item ps-meta-item--block">
                            <span className="ps-meta-icon" aria-hidden="true">⏱️</span>
                            <span className="ps-meta-label">Duración:</span>
                            <span className="ps-meta-value ps-meta-value--clip">{formatDuracion(v.duracion)}</span>
                          </span>
                          <span className="ps-meta-item ps-meta-item--block">
                            <span className="ps-meta-icon ps-meta-icon--precio" aria-hidden="true">💲</span>
                            <span className="ps-meta-label">Precio:</span>
                            <span className="ps-meta-value ps-meta-value--clip">${Number(v.precio).toLocaleString('es-AR')}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <svg className="ps-servicio-card__arrow" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            PASO 3 — Reserva: info + franja de fechas + slots
        ══════════════════════════════════════════════════ */}
        {step === 'reserva' && selectedServicio && (
          <div className="ps-section">

            {/* ── Header: flecha volver | nombre centrado | aclaración | duración · precio ── */}
            <div className="ps-reserva-header">
              <button className="ps-reserva-back" onClick={handleBack} aria-label="Volver">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div className="ps-reserva-titulo">
                <h3 className="ps-reserva-nombre" ref={nombreRef}>{selectedServicio.nombre}</h3>
                {selectedServicio.aclaracion && (
                  <p className="ps-reserva-acl">{selectedServicio.aclaracion}</p>
                )}
                {(() => {
                  const v = getVersionActiva(selectedServicio.servicios)
                  if (!v) return null
                  return (
                    <>
                      <div className="ps-reserva-meta-row">
                        <span className="ps-reserva-row">
                          <span className="ps-meta-icon" aria-hidden="true">⏱️</span>
                          <span className="ps-meta-label">Duración:</span>
                          <span className="ps-meta-value">{formatDuracion(v.duracion)}</span>
                        </span>
                        <span className="ps-reserva-row">
                          <span className="ps-meta-icon ps-meta-icon--precio" aria-hidden="true">💲</span>
                          <span className="ps-meta-label">Precio:</span>
                          <span className="ps-meta-value">${Number(v.precio).toLocaleString('es-AR')}</span>
                        </span>
                      </div>
                      {selectedServicio.profesional_id && !cualquieraProfesional && (
                        <ProfReservaLabel
                          nombre={selectedServicio.profesional_nombre}
                          apellido={selectedServicio.profesional_apellido}
                          dni={selectedServicio.profesional_dni}
                        />
                      )}
                    </>
                  )
                })()}
              </div>
              {/* spacer para que el nombre quede verdaderamente centrado */}
              <div aria-hidden="true" />
            </div>

            {/* ── Separador ── */}
            <div className="ps-divider" />

            {/* ── Franja de fechas ── */}
            <DateStrip
              servicio={selectedServicio}
              serviciosGrupo={cualquieraProfesional ? selectedGrupo : null}
              selectedFecha={selectedFecha}
              onSelectFecha={handleSelectFecha}
              onExcepcion={(motivo) => setExcepcionInfo(motivo ?? '')}
            />

            {/* ── Slots: aparecen al seleccionar fecha ── */}
            {selectedFecha && (
              <div className="ps-reserva-slots">

                {/* Aviso de cambio de versión para esta fecha */}
                {(() => {
                  const vHoy   = getVersionActiva(selectedServicio.servicios)
                  const vFecha = getVersionParaFecha(selectedServicio, selectedFecha)
                  if (!vFecha || !vHoy || vFecha.id === vHoy.id) return null
                  const durCambio    = vFecha.duracion !== vHoy.duracion
                  const precioCambio = Number(vFecha.precio) !== Number(vHoy.precio)
                  if (!durCambio && !precioCambio) return null

                  // Formatea YYYY-MM-DD → DD/MM/YY
                  const [vy, vm, vd] = (vFecha.vigente_desde ?? '').split('-')
                  const fechaLabel = `${vd}/${vm}/${vy.slice(-2)}`
                  const titulo = (durCambio && precioCambio)
                    ? `Cambios a partir del día ${fechaLabel}:`
                    : `Cambio a partir del día ${fechaLabel}:`

                  return (
                    <div className="ps-version-banner">
                      <span className="ps-version-banner__title">{titulo}</span>
                      <div className="ps-version-banner__meta">
                        {durCambio && (
                          <span className="ps-version-banner__item">
                            <span className="ps-version-banner__icon" aria-hidden="true">⏱️</span>
                            <span className="ps-version-banner__label">Duración:</span>
                            <span className="ps-version-banner__value">{formatDuracion(vFecha.duracion)}</span>
                          </span>
                        )}
                        {precioCambio && (
                          <span className="ps-version-banner__item">
                            <span className="ps-version-banner__icon ps-version-banner__icon--precio" aria-hidden="true">💲</span>
                            <span className="ps-version-banner__label">Precio:</span>
                            <span className="ps-version-banner__value">${Number(vFecha.precio).toLocaleString('es-AR')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {slots.length === 0 ? (
                  <p className="ps-empty">No hay horarios disponibles para este día.</p>
                ) : (
                  <div className="ps-slots-grid">
                    {slots.map((slot, i) => {
                      const isSelected = selectedSlot?.label === slot.label && !slot.bloqueado
                      return (
                        <button
                          key={i}
                          className={[
                            'ps-slot',
                            slot.bloqueado ? 'ps-slot--bloqueado' : '',
                            isSelected     ? 'ps-slot--selected'  : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            if (!slot.bloqueado) { setSelectedSlot(slot); setBookingOpen(true) }
                          }}
                          disabled={slot.bloqueado}
                          aria-label={`${slot.label}${slot.bloqueado ? ' (ocupado)' : ''}`}
                        >
                          {slot.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>{/* /ps-body */}

      {/* ══════════════════════════════════════════════════
          Modal: confirmación de turno
      ══════════════════════════════════════════════════ */}
      {bookingOpen && selectedSlot && selectedServicio && (
        <div className="ps-booking-overlay">
          <div className="ps-booking-modal" onClick={e => e.stopPropagation()}>

            {/* Cabecera roja */}
            <div className="ps-booking-header">
              <div className="ps-booking-header-icon">
                <span aria-hidden="true">📅</span>
              </div>
              <h3 className="ps-booking-title">Confirmá tu turno</h3>
              <button className="ps-modal-close" onClick={() => { setBookingOpen(false); setSelectedSlot(null) }} aria-label="Cerrar" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="ps-booking-body">
              <div className="ps-booking-details">

                {/* Servicio — azul */}
                <BookingRow
                  color="blue"
                  modifier="booking-row--service"
                  icon={<span aria-hidden="true">✂️</span>}
                  fitText
                >
                  <span>{selectedServicio.nombre}</span>
                </BookingRow>

                {/* Fecha · Hora — rojo */}
                <BookingRow
                  color="red"
                  modifier="booking-row--datetime"
                  icon={<span aria-hidden="true">📅</span>}
                  fitText
                >
                  <span>{formatFecha(selectedFecha)} · {selectedSlot.label} hs</span>
                </BookingRow>

                {/* Duración + Precio en la misma fila */}
                <BookingRow color="orange" modifier="booking-row--meta" icon={null}>
                  <div className="booking-row__meta-dur">
                    <div className="booking-row__icon booking-row__icon--orange">
                      <span aria-hidden="true">⏱️</span>
                    </div>
                    {formatDuracion(selectedSlot.version.duracion)}
                  </div>
                  <div className="booking-row__meta-price">
                    <div className="booking-row__icon booking-row__icon--green">
                      <span aria-hidden="true">💲</span>
                    </div>
                    ${Number(selectedSlot.version.precio).toLocaleString('es-AR')}
                  </div>
                </BookingRow>

                {/* Profesional (opcional) — madera; oculto si el usuario eligió indiferente */}
                {selectedServicio.profesional_id && !cualquieraProfesional && (
                  <BookingRow
                    color="brown"
                    modifier="booking-row--professional-brown"
                    icon={<span aria-hidden="true">💼</span>}
                    fitText
                  >
                    <span>{selectedServicio.profesional_apellido}, {selectedServicio.profesional_nombre}</span>
                  </BookingRow>
                )}

              </div>

              <div className="ps-booking-actions">
                <button className="btn btn-secondary"
                  onClick={() => { setBookingOpen(false); setSelectedSlot(null) }}>
                  Cancelar
                </button>
                <button className="btn ps-booking-btn-confirm"
                  onClick={handleConfirmar}
                  disabled={reservando}>
                  {reservando
                    ? <><span className="spinner spinner-sm" /> Reservando…</>
                    : 'Confirmar'
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal: fecha bloqueada (excepción)
      ══════════════════════════════════════════════════ */}
      {excepcionInfo !== null && (
        <div className="ps-exc-overlay">
          <div className="ps-exc-modal" onClick={e => e.stopPropagation()}>
            <button className="ps-modal-close" onClick={() => setExcepcionInfo(null)} aria-label="Cerrar" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="ps-exc-icon">🚫</div>
            <p className="ps-exc-title">Fecha no disponible</p>
            <p className="ps-exc-motivo">
              {excepcionInfo || 'Esta fecha no está disponible para reservas.'}
            </p>
            <button className="btn btn-primary" onClick={() => setExcepcionInfo(null)}>
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Modales de éxito / error */}
      {exito && (
        <ErrorModal
          success="¡Turno reservado con éxito! Podés verlo en tu panel de turnos."
          onClose={handleExitoClose}
        />
      )}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}

    </div>
  )
}
