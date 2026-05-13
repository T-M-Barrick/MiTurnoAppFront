import { useState, useEffect, useRef } from 'react'
import { useFooterLayout } from '../../utils/useFooterLayout'
import ErrorModal from '../ErrorModal/ErrorModal'
import './HorariosModal.css'

// Nombres completos y abreviados de días (0 = lunes, 6 = domingo)
const DIAS      = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_ABREV = ['Lun',  'Mar',    'Mié',        'Jue',    'Vie',     'Sáb',    'Dom']


/** Construye estado vacío por día: { 0: [], ..., 6: [] } */
function buildEmptyDays() {
  const days = {}
  for (let i = 0; i < 7; i++) days[i] = []
  return days
}

/**
 * Separa "HH:MM[...]" en { h: string, m: string } sin padding.
 * Ej: "08:30" → { h: '8', m: '30' }
 */
function splitTime(timeStr) {
  if (!timeStr) return { h: '', m: '' }
  const parts = timeStr.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return {
    h: isNaN(h) ? '' : String(h).padStart(2, '0'),
    m: isNaN(m) ? '' : String(m).padStart(2, '0'),
  }
}

/**
 * Combina h y m strings en "HH:MM".
 * Retorna '' si alguno está vacío (validación lo captura).
 */
function buildTime(h, m) {
  if (h === '' || m === '') return ''
  const hh = Math.max(0, Math.min(23, parseInt(h, 10) || 0))
  const mm = Math.max(0, Math.min(59, parseInt(m, 10) || 0))
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0')
}

/**
 * Convierte "HH:MM" a minutos totales.
 */
function toMinutes(timeStr) {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

/**
 * Ordena franjas por hora de inicio (ascendente).
 * Las franjas con horario incompleto quedan al final.
 */
function sortSlotsByTime(slots) {
  return [...slots].sort((a, b) => {
    const aMin = toMinutes(buildTime(a.inicio_h, a.inicio_m)) ?? Infinity
    const bMin = toMinutes(buildTime(b.inicio_h, b.inicio_m)) ?? Infinity
    return aMin - bMin
  })
}

/**
 * Verifica si dos franjas se superponen o se tocan en los extremos.
 * Replica la regla del back: los extremos tampoco pueden tocarse.
 */
function slotsOverlap(a, b) {
  const a1 = toMinutes(buildTime(a.inicio_h, a.inicio_m))
  const a2 = toMinutes(buildTime(a.fin_h,    a.fin_m))
  const b1 = toMinutes(buildTime(b.inicio_h, b.inicio_m))
  const b2 = toMinutes(buildTime(b.fin_h,    b.fin_m))
  if (a1 === null || a2 === null || b1 === null || b2 === null) return false
  // Superpuestos o tocándose: !(a2 < b1 || b2 < a1)
  return !(a2 < b1 || b2 < a1)
}

/**
 * Agrupa disponibilidades por día, expandiendo los tiempos a campos h/m separados.
 * Las franjas de cada día se ordenan por hora de inicio.
 */
function groupByDay(disponibilidades) {
  const grouped = buildEmptyDays()
  for (const disp of disponibilidades) {
    if (disp.dia >= 0 && disp.dia <= 6) {
      const si = splitTime(disp.hora_inicio ?? '')
      const sf = splitTime(disp.hora_fin ?? '')
      grouped[disp.dia].push({
        inicio_h:        si.h,
        inicio_m:        si.m,
        fin_h:           sf.h,
        fin_m:           sf.m,
        intervalo:       disp.intervalo ?? 30,
        cant_turnos_max: disp.cant_turnos_max !== undefined ? disp.cant_turnos_max : 1,
      })
    }
  }
  // Ordenar cada día por hora de inicio
  for (let i = 0; i < 7; i++) {
    grouped[i] = sortSlotsByTime(grouped[i])
  }
  return grouped
}

/**
 * Valida todas las franjas de todos los días.
 * Retorna objeto { "dia-idx": "mensaje" }
 */
function validateSlots(days) {
  const errors = {}

  for (let dia = 0; dia < 7; dia++) {
    days[dia].forEach((slot, idx) => {
      const key = `${dia}-${idx}`

      // Validar rango de horas (0–23) y minutos (0–59) antes de construir el tiempo
      const h_ini = slot.inicio_h !== '' ? parseInt(slot.inicio_h, 10) : NaN
      const m_ini = slot.inicio_m !== '' ? parseInt(slot.inicio_m, 10) : NaN
      const h_fin = slot.fin_h    !== '' ? parseInt(slot.fin_h,    10) : NaN
      const m_fin = slot.fin_m    !== '' ? parseInt(slot.fin_m,    10) : NaN

      if (isNaN(h_ini) || isNaN(m_ini) || isNaN(h_fin) || isNaN(m_fin)) {
        errors[key] = 'Completá las horas de inicio y fin'
        return
      }
      if (h_ini < 0 || h_ini > 23 || h_fin < 0 || h_fin > 23) {
        errors[key] = 'Las horas deben estar entre 0 y 23'
        return
      }
      if (m_ini < 0 || m_ini > 55 || m_fin < 0 || m_fin > 55) {
        errors[key] = 'Los minutos deben estar entre 0 y 55'
        return
      }

      const hora_inicio = buildTime(slot.inicio_h, slot.inicio_m)
      const hora_fin    = buildTime(slot.fin_h, slot.fin_m)
      const inicioMin   = toMinutes(hora_inicio)
      const finMin      = toMinutes(hora_fin)

      // Minutos deben ser múltiplo de 5
      if (m_ini % 5 !== 0) {
        errors[key] = 'El inicio debe ser múltiplo de 5 minutos (ej: 8:00, 8:15, 8:30…)'
        return
      }
      if (m_fin % 5 !== 0) {
        errors[key] = 'El fin debe ser múltiplo de 5 minutos (ej: 9:00, 9:30…)'
        return
      }

      // Fin debe ser mayor a inicio
      if (finMin <= inicioMin) {
        errors[key] = 'La hora de fin debe ser mayor a la hora de inicio'
        return
      }

      // Duración debe ser divisible por el intervalo
      const duracion  = finMin - inicioMin
      const intervalo = Number(slot.intervalo)
      if (duracion % intervalo !== 0) {
        errors[key] = `La duración (${duracion} min) debe ser divisible por el intervalo (${intervalo} min)`
        return
      }

      // cant_turnos_max >= 0
      const cantMax = Number(slot.cant_turnos_max)
      if (isNaN(cantMax) || cantMax < 0) {
        errors[key] = 'La cantidad máxima de turnos debe ser mayor o igual a 0'
      }
    })
  }

  return errors
}

/**
 * Modal para configurar las disponibilidades (horarios) de un servicio.
 *
 * Props:
 *   disponibilidades — array de DisponibilidadServicio
 *   onClose          — callback al cerrar sin guardar
 *   onSave           — callback(disponibilidades) al guardar
 */
export default function HorariosModal({ disponibilidades, onClose, onSave }) {
  const [days,        setDays]        = useState(() => groupByDay(disponibilidades))
  const [slotErrors,  setSlotErrors]  = useState({})
  const [selectedDay, setSelectedDay] = useState(0)
  // copyMenu: { dia, idx } | null — franja cuyo menú de copia está abierto
  const [copyMenu,    setCopyMenu]    = useState(null)
  // overlapError: true cuando hay superposición (muestra ErrorModal)
  const [overlapError, setOverlapError] = useState(false)

  const footerRef  = useRef(null)
  const footerMode = useFooterLayout(footerRef)

  // Cierra con Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (copyMenu) { setCopyMenu(null); return }
        if (overlapError) { setOverlapError(false); return }
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, copyMenu, overlapError])

  /** Agrega una franja vacía al día seleccionado */
  const addSlot = (dia) => {
    setDays((prev) => ({
      ...prev,
      [dia]: [
        ...prev[dia],
        { inicio_h: '', inicio_m: '', fin_h: '', fin_m: '', intervalo: 5, cant_turnos_max: 1 },
      ],
    }))
  }

  /** Elimina una franja */
  const removeSlot = (dia, idx) => {
    setDays((prev) => ({
      ...prev,
      [dia]: prev[dia].filter((_, i) => i !== idx),
    }))
    setSlotErrors((prev) => {
      const copy = { ...prev }
      delete copy[`${dia}-${idx}`]
      return copy
    })
  }

  /** Actualiza un campo de una franja */
  const updateSlot = (dia, idx, field, value) => {
    setDays((prev) => {
      const updated = prev[dia].map((slot, i) =>
        i === idx ? { ...slot, [field]: value } : slot
      )
      return { ...prev, [dia]: updated }
    })
    setSlotErrors((prev) => {
      const copy = { ...prev }
      delete copy[`${dia}-${idx}`]
      return copy
    })
  }

  /**
   * Copia la franja seleccionada al día destino.
   * Si se superpone con alguna franja existente, muestra error modal.
   */
  const handleCopyToDay = (targetDia) => {
    const { dia, idx } = copyMenu
    const slot = days[dia][idx]
    const existing = days[targetDia]

    // Verificar superposición incluyendo tocar en los extremos
    const hasOverlap = existing.some((other) => slotsOverlap(slot, other))
    setCopyMenu(null)

    if (hasOverlap) {
      setOverlapError(true)
      return
    }

    // Insertar y reordenar por hora de inicio
    const newSlots = sortSlotsByTime([...existing, { ...slot }])
    setDays((prev) => ({ ...prev, [targetDia]: newSlots }))
  }

  /** Valida, chequea superposiciones y guarda */
  const handleSave = () => {
    const errors = validateSlots(days)
    if (Object.keys(errors).length > 0) {
      setSlotErrors(errors)
      // Navega al primer día con error
      const firstErrDay = parseInt(Object.keys(errors)[0].split('-')[0], 10)
      setSelectedDay(firstErrDay)
      return
    }
    setSlotErrors({})

    // Verificar superposiciones entre franjas del mismo día
    for (let dia = 0; dia < 7; dia++) {
      const slots = days[dia]
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          if (slotsOverlap(slots[i], slots[j])) {
            setSelectedDay(dia)
            setOverlapError(true)
            return
          }
        }
      }
    }

    // Aplanar al formato del back, ordenado por día y hora de inicio
    const flat = []
    for (let dia = 0; dia < 7; dia++) {
      const sorted = sortSlotsByTime(days[dia])
      for (const slot of sorted) {
        flat.push({
          dia,
          hora_inicio:     buildTime(slot.inicio_h, slot.inicio_m),
          hora_fin:        buildTime(slot.fin_h, slot.fin_m),
          intervalo:       Number(slot.intervalo),
          cant_turnos_max: Number(slot.cant_turnos_max),
        })
      }
    }
    onSave(flat)
  }

  const slotsActivos = days[selectedDay]

  return (
    <>
      <div
        className="hm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Configurar horarios"
      >
        <div className="hm-card" onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="hm-header">
            <h2 className="hm-header__title">Configurar horarios</h2>
            <button className="btn-icon" onClick={onClose} type="button" aria-label="Cerrar">✕</button>
          </div>

          {/* ── Fila de tabs de días ── */}
          <div className="hm-day-tabs">
            {DIAS.map((diaName, diaIdx) => {
              const count    = days[diaIdx].length
              const isActive = selectedDay === diaIdx
              return (
                <button
                  key={diaIdx}
                  type="button"
                  className={`hm-day-tab${isActive ? ' hm-day-tab--active' : ''}`}
                  onClick={() => setSelectedDay(diaIdx)}
                  aria-pressed={isActive}
                >
                  <span className="hm-day-tab__name">{DIAS_ABREV[diaIdx]}</span>
                  {count > 0 && (
                    <span className="hm-day-tab__badge">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Cuerpo: franjas del día seleccionado ── */}
          <div className="hm-body">

            {/* Nombre completo del día activo */}
            <div className="hm-day-title">{DIAS[selectedDay]}</div>

            {/* Lista de franjas */}
            {slotsActivos.length === 0 ? (
              <div className="hm-empty-day">Sin franjas configuradas para este día</div>
            ) : (
              <div className="hm-slots">
                {slotsActivos.map((slot, slotIdx) => {
                  const errKey = `${selectedDay}-${slotIdx}`
                  const hasErr = !!slotErrors[errKey]

                  return (
                    <div key={slotIdx} className="hm-slot-wrap">
                      <div className={`hm-slot${hasErr ? ' hm-slot--error' : ''}`}>

                        {/* Inicio */}
                        <div className="hm-slot__group">
                          <span className="hm-slot__label">Inicio</span>
                          <div className="hm-slot__time">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="hm-slot__input hm-slot__input--hh"
                              value={slot.inicio_h}
                              placeholder="00"
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                updateSlot(selectedDay, slotIdx, 'inicio_h', val)
                              }}
                            />
                            <span className="hm-slot__colon">:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="hm-slot__input hm-slot__input--mm"
                              value={slot.inicio_m}
                              placeholder="00"
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                updateSlot(selectedDay, slotIdx, 'inicio_m', val)
                              }}
                            />
                          </div>
                        </div>

                        {/* Separador visual */}
                        <span className="hm-slot__arrow">→</span>

                        {/* Fin */}
                        <div className="hm-slot__group">
                          <span className="hm-slot__label">Fin</span>
                          <div className="hm-slot__time">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="hm-slot__input hm-slot__input--hh"
                              value={slot.fin_h}
                              placeholder="23"
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                updateSlot(selectedDay, slotIdx, 'fin_h', val)
                              }}
                            />
                            <span className="hm-slot__colon">:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="hm-slot__input hm-slot__input--mm"
                              value={slot.fin_m}
                              placeholder="55"
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                updateSlot(selectedDay, slotIdx, 'fin_m', val)
                              }}
                            />
                          </div>
                        </div>

                        {/* Salto (intervalo libre, hasta 3 dígitos) */}
                        <div className="hm-slot__group">
                          <span className="hm-slot__label">Salto</span>
                          <div className="hm-slot__time">
                            <input
                              type="number"
                              className="hm-slot__input hm-slot__input--salto"
                              value={slot.intervalo}
                              placeholder="30"
                              min={1}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 3)
                                updateSlot(selectedDay, slotIdx, 'intervalo', val)
                              }}
                            />
                            <span className="hm-slot__unit">minutos</span>
                          </div>
                        </div>

                        {/* Turnos simultáneos */}
                        <div className="hm-slot__group">
                          <span className="hm-slot__label">Turnos simultáneos</span>
                          <input
                            type="number"
                            className="hm-slot__input hm-slot__input--max"
                            value={slot.cant_turnos_max}
                            min={0}
                            onChange={(e) => updateSlot(selectedDay, slotIdx, 'cant_turnos_max', e.target.value)}
                          />
                        </div>

                        {/* Botón copiar franja a otro día */}
                        <button
                          className="hm-slot__copy"
                          type="button"
                          onClick={() => setCopyMenu(
                            copyMenu && copyMenu.dia === selectedDay && copyMenu.idx === slotIdx
                              ? null
                              : { dia: selectedDay, idx: slotIdx }
                          )}
                          aria-label={`Copiar franja ${slotIdx + 1} a otro día`}
                          title="Copiar a otro día"
                        >
                          {/* Ícono de copia (dos hojas) */}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>

                        {/* Botón eliminar franja */}
                        <button
                          className="hm-slot__remove"
                          type="button"
                          onClick={() => removeSlot(selectedDay, slotIdx)}
                          aria-label={`Eliminar franja ${slotIdx + 1}`}
                        >
                          <svg width="12" height="2" viewBox="0 0 12 2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="1" y1="1" x2="11" y2="1"/>
                          </svg>
                        </button>

                      </div>

                      {/* Error de validación de la franja */}
                      {hasErr && (
                        <div className="hm-slot__error">{slotErrors[errKey]}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Botón agregar franja */}
            <button
              className="hm-add-slot"
              type="button"
              onClick={() => addSlot(selectedDay)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5"  y1="12" x2="19" y2="12"/>
              </svg>
              Agregar franja
            </button>

          </div>

          {/* ── Footer ── */}
          <div ref={footerRef} className={`hm-footer hm-footer--${footerMode}`}>
            <button className="btn hm-btn-cancel" onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="btn hm-btn-save" onClick={handleSave} type="button">
              Guardar horarios
            </button>
          </div>

        </div>
      </div>

      {/* Menú de copia a otro día */}
      {copyMenu !== null && (
        <div className="hm-copy-overlay" onClick={() => setCopyMenu(null)}>
          <div className="hm-copy-menu" onClick={(e) => e.stopPropagation()}>
            <div className="hm-copy-menu__title">Copiar franja a:</div>
            {DIAS.map((diaName, diaIdx) => {
              // No mostrar el día actual
              if (diaIdx === copyMenu.dia) return null
              return (
                <button
                  key={diaIdx}
                  className="hm-copy-menu__item"
                  type="button"
                  onClick={() => handleCopyToDay(diaIdx)}
                >
                  {diaName}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de error de superposición */}
      {overlapError && (
        <ErrorModal
          error={{ code: 'SUCURSAL_SERVICE_DISPONIBILIDAD_SUPERPUESTA' }}
          onClose={() => setOverlapError(false)}
        />
      )}
    </>
  )
}
