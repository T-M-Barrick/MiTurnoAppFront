import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { usuarioService } from '../../services/usuarioService'
import { sucursalService } from '../../services/sucursalService'
import { formatDuracion, getVersionActiva } from '../../utils/dateUtils'
import BookingRow from '../BookingRow/BookingRow'
import ErrorModal from '../ErrorModal/ErrorModal'
import './ReservarTurnoModal.css'

// ─────────────────────────────────────────────────────────────────
// Constantes de localización
// ─────────────────────────────────────────────────────────────────

const MESES       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const STRIP_DAYS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const STRIP_STRIDE = 66

const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? '--'

// ─────────────────────────────────────────────────────────────────
// Helpers de fecha / tiempo
// ─────────────────────────────────────────────────────────────────

function formatFecha(date) {
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`
}

function getDiaSemana(date) {
  return (date.getDay() + 6) % 7
}

function parseTimeToMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function getVersionParaFecha(servicio, fecha) {
  const f = new Date(fecha); f.setHours(0, 0, 0, 0)
  return servicio.servicios.find(sv => {
    const desde = new Date(sv.vigente_desde + 'T00:00:00')
    const hasta  = sv.vigente_hasta ? new Date(sv.vigente_hasta + 'T23:59:59') : null
    return f >= desde && (hasta === null || f <= hasta)
  }) ?? null
}

function fechaTieneDisponibilidad(servicio, fecha) {
  const version = getVersionParaFecha(servicio, fecha)
  if (!version) return false
  return version.disponibilidades.some(d => d.dia === getDiaSemana(fecha))
}

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

function findFirstAvailableDate(servicio) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const max = servicio.limite_dias_reserva ?? 1460
  for (let i = 0; i <= max; i++) {
    const d = new Date(hoy.getTime() + i * 86400000)
    if (getDayStatus(servicio, d) === 'disponible') return d
  }
  return null
}

function calcularSlots(servicio, fecha, allServicios = []) {
  const fechaBase = new Date(fecha)
  fechaBase.setHours(0, 0, 0, 0)

  const version = getVersionParaFecha(servicio, fechaBase)
  if (!version) return []

  const diaSemana = getDiaSemana(fechaBase)
  const disps = version.disponibilidades.filter(d => d.dia === diaSemana)
  if (!disps.length) return []

  const ahora = new Date()
  const slots  = []

  const turnosConflicto = servicio.profesional_id != null
    ? allServicios
        .filter(s => s.id !== servicio.id && s.profesional_id === servicio.profesional_id)
        .flatMap(s => s.turnos_actuales)
    : []

  for (const disp of disps) {
    const inicio  = parseTimeToMin(disp.hora_inicio)
    const rawFin  = parseTimeToMin(disp.hora_fin)
    const fin     = Math.min(rawFin === 0 ? 24 * 60 : rawFin, 23 * 60 + 55)

    for (let t = inicio; t <= fin; t += disp.intervalo) {
      const slotDate = new Date(fechaBase)
      slotDate.setHours(Math.floor(t / 60), t % 60, 0, 0)
      if (slotDate.toDateString() !== fechaBase.toDateString()) continue
      const slotEnd  = new Date(slotDate.getTime() + version.duracion * 60000)

      const supPropios = servicio.turnos_actuales.filter(tu => {
        const ts = new Date(tu.fecha_hora)
        const te = new Date(ts.getTime() + tu.duracion * 60000)
        return slotDate < te && slotEnd > ts
      })

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

  return slots.sort((a, b) => a.fechaHora - b.fechaHora)
}

// ─────────────────────────────────────────────────────────────────
// Sub-componente: franja horizontal de fechas
// ─────────────────────────────────────────────────────────────────

function DateStrip({ servicio, selectedFecha, onSelectFecha, onExcepcion }) {
  const stripRef      = useRef(null)
  const pickerRef     = useRef(null)
  const today         = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const [visibleMonth,    setVisibleMonth]    = useState(today.getMonth())
  const [visibleYear,     setVisibleYear]     = useState(today.getFullYear())
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [pickerYear,      setPickerYear]      = useState(today.getFullYear())
  const [tooltip,         setTooltip]         = useState(null)

  // Cierra el picker al hacer click fuera de él
  useEffect(() => {
    if (!monthPickerOpen) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setMonthPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [monthPickerOpen])

  const dates = useMemo(() => {
    const max = servicio.limite_dias_reserva ?? 1460
    return Array.from({ length: max + 1 }, (_, i) => new Date(today.getTime() + i * 86400000))
  }, [servicio, today])

  const statuses = useMemo(
    () => dates.map(d => getDayStatus(servicio, d)),
    [dates, servicio]
  )

  const availableMonths = useMemo(() => {
    const seen = new Set()
    return dates.reduce((acc, d) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!seen.has(key)) { seen.add(key); acc.push({ year: d.getFullYear(), month: d.getMonth() }) }
      return acc
    }, [])
  }, [dates])

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

  const scrollToIdx = useCallback((idx) => {
    stripRef.current?.scrollTo({ left: Math.max(0, idx * STRIP_STRIDE), behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!selectedFecha) return
    const idx = dates.findIndex(d => d.toDateString() === selectedFecha.toDateString())
    if (idx >= 0) scrollToIdx(idx)
  }, [selectedFecha, dates, scrollToIdx])

  const handleScroll = useCallback(() => {
    if (!stripRef.current) return
    const idx = Math.round(stripRef.current.scrollLeft / STRIP_STRIDE)
    const d = dates[Math.min(idx, dates.length - 1)]
    if (d) { setVisibleMonth(d.getMonth()); setVisibleYear(d.getFullYear()) }
  }, [dates])

  const goLeft  = () => stripRef.current?.scrollBy({ left: -STRIP_STRIDE, behavior: 'smooth' })
  const goRight = () => stripRef.current?.scrollBy({ left:  STRIP_STRIDE, behavior: 'smooth' })

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

  const handlePickMonth = (year, month) => {
    setMonthPickerOpen(false)
    const idx = dates.findIndex((d, i) => {
      if (d.getFullYear() !== year || d.getMonth() !== month) return false
      const s = statuses[i]
      return (typeof s === 'string' ? s : s?.status) === 'disponible'
    })
    const fallback = dates.findIndex(d => d.getFullYear() === year && d.getMonth() === month)
    scrollToIdx(idx >= 0 ? idx : fallback)
  }

  useEffect(() => {
    if (!monthPickerOpen) return
    const close = () => setMonthPickerOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [monthPickerOpen])

  return (
    <div className="ps-strip-wrapper">
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
              <div className="ps-month-picker" ref={pickerRef} onClick={e => e.stopPropagation()}>
                <div className="ps-month-picker__year-nav">
                  <button className="ps-month-picker__year-arrow" type="button"
                    onClick={() => setPickerYear(y => Math.max(minYear, y - 1))}
                    disabled={pickerYear <= minYear} aria-label="Año anterior">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <span className="ps-month-picker__year-title">{pickerYear}</span>
                  <button className="ps-month-picker__year-arrow" type="button"
                    onClick={() => setPickerYear(y => Math.min(maxYear, y + 1))}
                    disabled={pickerYear >= maxYear} aria-label="Año siguiente">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
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

      <div className="ps-strip-outer">
        <button className="ps-strip-arrow ps-strip-arrow--left" type="button" onClick={goLeft} aria-label="Día anterior">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div className="ps-strip" ref={stripRef} onScroll={handleScroll}>
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

      {tooltip && (
        <div className="ps-strip-tooltip"
          style={{ left: `${tooltip.rect.left + tooltip.rect.width / 2}px`, top: `${tooltip.rect.top - 8}px` }}>
          {tooltip.motivo}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sub-componente: nombre de profesional con font adaptable
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────

/**
 * Modal para reservar turno a un cliente desde la vista empresa.
 *
 * Props:
 *   sucursalId — id de la sucursal
 *   cliente    — objeto ClienteOut del cliente al que se le reserva
 *   onClose    — cierra el modal
 *   onError    — callback(errorObj)
 */
export default function ReservarTurnoModal({ sucursalId, cliente, onClose, onError }) {

  const [servicios,  setServicios]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [backError,  setBackError]  = useState(null)

  // Flujo de reserva
  const [step,             setStep]             = useState('servicios')
  const [selectedNombre,   setSelectedNombre]   = useState(null)
  const [selectedServicio, setSelectedServicio] = useState(null)
  const [selectedFecha,    setSelectedFecha]    = useState(null)
  const [selectedSlot,     setSelectedSlot]     = useState(null)

  // Modales internos
  const [excepcionInfo, setExcepcionInfo] = useState(null)
  const [reservando,    setReservando]    = useState(false)
  const [exito,         setExito]         = useState(false)
  const [bookingOpen,   setBookingOpen]   = useState(false)

  // Shrink del nombre del servicio en paso reserva
  const nombreRef = useRef(null)
  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    el.style.fontSize = ''
    const MAX_FS = 22
    const MIN_FS = 13
    let fs = MAX_FS
    const available = el.parentElement?.clientWidth ?? 0
    while (el.offsetWidth > available && fs > MIN_FS) {
      fs -= 1
      el.style.fontSize = `${fs}px`
    }
  }, [selectedServicio])

  // Cierra con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !bookingOpen && !excepcionInfo) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, bookingOpen, excepcionInfo])

  // Carga los servicios al montar — modo empresa (usuario=false)
  useEffect(() => {
    if (!sucursalId) return
    setLoading(true)
    sucursalService.getServiciosParaReserva(sucursalId, false, cliente?.email ?? null)
      .then(data => setServicios(data))
      .catch(err  => setBackError(err))
      .finally(()  => setLoading(false))
  }, [sucursalId])

  // Agrupa servicios por nombre
  const serviciosByNombre = useMemo(() => {
    const map = {}
    servicios.forEach(s => {
      if (!map[s.nombre]) map[s.nombre] = []
      map[s.nombre].push(s)
    })
    return map
  }, [servicios])

  const slots = useMemo(() => {
    if (!selectedServicio || !selectedFecha) return []
    return calcularSlots(selectedServicio, selectedFecha, servicios)
  }, [selectedServicio, selectedFecha, servicios])

  // ── Navegación del flujo ──

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

  const handleSelectFecha = (fecha) => {
    setSelectedFecha(fecha)
    setSelectedSlot(null)
  }

  const handleBack = () => {
    if (step === 'reserva') {
      const multipleProf = (serviciosByNombre[selectedServicio?.nombre]?.length ?? 0) > 1
      setSelectedFecha(null)
      setSelectedSlot(null)
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
      await sucursalService.reservarTurnoCliente(sucursalId, {
        cliente_id:  cliente.id,
        servicio_id: selectedSlot.version.id,
        fecha_hora:  selectedSlot.fechaHora.toISOString(),
      })
      // Inyectar el turno recién tomado para recalcular slots sin nuevo GET
      const nuevoTurno = { fecha_hora: selectedSlot.fechaHora.toISOString(), duracion: selectedSlot.version.duracion }
      setServicios(prev => prev.map(s =>
        s.id === selectedServicio.id
          ? { ...s, turnos_actuales: [...s.turnos_actuales, nuevoTurno] }
          : s
      ))
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
    setBookingOpen(false)
    setSelectedSlot(null)
  }

  // ─────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="rturno-overlay">
      <div className="rturno-modal" onClick={e => e.stopPropagation()}>

        {/* ═══ CABECERA ═══ */}
        <div className="rturno-header">
          <button className="btn-icon rturno-header__close" onClick={onClose} aria-label="Cerrar">✕</button>
          <div className="rturno-header__center">
            <h2 className="rturno-header__title">Reservar turno</h2>
            <p className="rturno-header__cliente">👤 {cliente.apellido}, {cliente.nombre}</p>
          </div>
        </div>

        {/* ═══ CUERPO SCROLLABLE ═══ */}
        <div className="rturno-body ps-body">

          {/* ── PASO 1: lista de servicios ── */}
          {step === 'servicios' && (
            <div className="ps-section">
              <h2 className="ps-section__title">Servicios disponibles</h2>

              {loading && <div className="ps-loading"><div className="spinner" /></div>}

              {!loading && Object.keys(serviciosByNombre).length === 0 && (
                <p className="ps-empty">Esta sucursal no tiene servicios disponibles.</p>
              )}

              {!loading && (
                <div className="ps-servicios-list">
                  {Object.entries(serviciosByNombre).map(([nombre, entries]) => {
                    const versionsHoy = entries.map(e => getVersionActiva(e.servicios)).filter(Boolean)
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
                      <button key={nombre} className="ps-servicio-card" onClick={() => handleSelectNombre(nombre)}>
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
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: selección de profesional ── */}
          {step === 'profesional' && selectedNombre && (
            <div className="ps-section">
              <div className="ps-prof-header">
                <button className="ps-reserva-back" onClick={handleBack} aria-label="Volver">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <div className="ps-reserva-titulo">
                  <h2 className="ps-section__title">Elegí un profesional</h2>
                  <p className="ps-section__sub">{selectedNombre}</p>
                </div>
                <div aria-hidden="true" />
              </div>

              <div className="ps-profesionales">
                {serviciosByNombre[selectedNombre].map(s => {
                  const v = getVersionActiva(s.servicios)
                  return (
                    <button key={s.id} className="ps-servicio-card" onClick={() => handleSelectProfesional(s)}>
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
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PASO 3: fechas + slots ── */}
          {step === 'reserva' && selectedServicio && (
            <div className="ps-section">

              <div className="ps-reserva-header">
                <button className="ps-reserva-back" onClick={handleBack} aria-label="Volver">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                        {selectedServicio.profesional_id && (
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
                <div aria-hidden="true" />
              </div>

              <div className="ps-divider" />

              <DateStrip
                servicio={selectedServicio}
                selectedFecha={selectedFecha}
                onSelectFecha={handleSelectFecha}
                onExcepcion={(motivo) => setExcepcionInfo(motivo ?? '')}
              />

              {selectedFecha && (
                <div className="ps-reserva-slots">

                  {(() => {
                    const vHoy   = getVersionActiva(selectedServicio.servicios)
                    const vFecha = getVersionParaFecha(selectedServicio, selectedFecha)
                    if (!vFecha || !vHoy || vFecha.id === vHoy.id) return null
                    const durCambio    = vFecha.duracion !== vHoy.duracion
                    const precioCambio = Number(vFecha.precio) !== Number(vHoy.precio)
                    if (!durCambio && !precioCambio) return null
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

        </div>{/* /rturno-body */}

        {/* ═══ FOOTER ═══ */}
        <div className="rturno-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>

      </div>{/* /rturno-modal */}

      {/* ── Sub-modal: confirmar reserva ── */}
      {bookingOpen && selectedSlot && selectedServicio && (
        <div className="ps-booking-overlay" onClick={e => e.stopPropagation()}>
          <div className="ps-booking-modal" onClick={e => e.stopPropagation()}>
            <div className="ps-booking-header">
              <div className="ps-booking-header-icon"><span aria-hidden="true">📅</span></div>
              <h3 className="ps-booking-title">Confirmá el turno</h3>
              <button className="ps-modal-close"
                onClick={() => { setBookingOpen(false); setSelectedSlot(null) }}
                aria-label="Cerrar" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="ps-booking-body">
              <div className="ps-booking-details">

                <BookingRow color="blue" modifier="booking-row--service"
                  icon={<span aria-hidden="true">✂️</span>} fitText>
                  <span>{selectedServicio.nombre}</span>
                </BookingRow>

                <BookingRow color="red" modifier="booking-row--datetime"
                  icon={<span aria-hidden="true">📅</span>} fitText>
                  <span>{formatFecha(selectedFecha)} · {selectedSlot.label} hs</span>
                </BookingRow>

                {/* Cliente */}
                <BookingRow color="indigo" modifier="booking-row--professional"
                  icon={<span aria-hidden="true">👤</span>} fitText>
                  <span>{cliente.apellido}, {cliente.nombre}</span>
                </BookingRow>

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

                {selectedServicio.profesional_id && (
                  <BookingRow color="brown" modifier="booking-row--professional-brown"
                    icon={<span aria-hidden="true">💼</span>} fitText>
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

      {/* ── Sub-modal: fecha bloqueada ── */}
      {excepcionInfo !== null && (
        <div className="ps-exc-overlay" onClick={e => e.stopPropagation()}>
          <div className="ps-exc-modal" onClick={e => e.stopPropagation()}>
            <button className="ps-modal-close" onClick={() => setExcepcionInfo(null)} aria-label="Cerrar" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="ps-exc-icon">🚫</div>
            <p className="ps-exc-title">Fecha no disponible</p>
            <p className="ps-exc-motivo">{excepcionInfo || 'Esta fecha no está disponible para reservas.'}</p>
            <button className="btn btn-primary" onClick={() => setExcepcionInfo(null)}>Aceptar</button>
          </div>
        </div>
      )}

      {/* Modales de éxito / error */}
      {exito && (
        <ErrorModal
          success="¡Turno reservado con éxito!"
          onClose={handleExitoClose}
        />
      )}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}

    </div>
  )
}
