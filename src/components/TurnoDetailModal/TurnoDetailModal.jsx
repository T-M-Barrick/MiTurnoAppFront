import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { formatFechaCompleta, labelEstado, formatDireccionCascade } from '../../utils/dateUtils'
import { usuarioService } from '../../services/usuarioService'
import RecordatorioField from '../RecordatorioField/RecordatorioField'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import CustomSelect from '../CustomSelect/CustomSelect'
import '../../styles/DetailModal.css'

/**
 * Formatea duración en palabras: "1 hora", "2 horas", "30 minutos", "1 hora 30 minutos", etc.
 */
function formatDuracionLarga(minutos) {
  if (!minutos) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  const partes = []
  if (h > 0) partes.push(`${h} ${h === 1 ? 'hora' : 'horas'}`)
  if (m > 0) partes.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`)
  return partes.join(' ')
}

/**
 * Formatea minutos de recordatorio para mostrar en el detalle.
 * Ej: 90 → "1 hs 30" | null → "Sin recordatorio"
 */
function formatRecDisplay(minutos) {
  if (!minutos) return 'Sin recordatorio'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  const partes = []
  if (h > 0) partes.push(`${h} ${h === 1 ? 'hora' : 'horas'}`)
  if (m > 0) partes.push(`${m} minutos`)
  return partes.join(' ') + ' antes'
}

/**
 * Modal de detalle completo de un turno (TurnoUserOut).
 *
 * Props:
 *   turno       — objeto TurnoUserOut | null
 *   onClose     — cerrar el modal
 *   onCanceled  — callback(turnoActualizado) al cancelar
 *   onUpdated   — callback(turnoActualizado) al marcar cumplido/no cumplido
 *   onDeleted   — callback(turnoId) al eliminar
 *   onError     — callback(errorObj) para mostrar ErrorModal
 */
export default function TurnoDetailModal({ turno, onClose, onCanceled, onUpdated, onDeleted, onError, readOnly = false }) {

  // ── Recordatorio (valor actual mostrado en la fila) ──
  const [currentRec, setCurrentRec] = useState(null) // minutos guardados, sincronizado con el turno

  // ── Sub-modal de edición de recordatorio ──
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [recEnabled,   setRecEnabled]   = useState(false)
  const [recH,         setRecH]         = useState('')
  const [recM,         setRecM]         = useState('00')
  const [recError,     setRecError]     = useState(null)
  const [savingRec,    setSavingRec]    = useState(false)
  const [recSuccess,   setRecSuccess]   = useState(false)

  // ── Confirmación de acción principal ──
  const [confirmAction, setConfirmAction] = useState(null) // 'cancel'|'delete'|'cumplido'|'no_cumplido'
  const [calificacion,  setCalificacion]  = useState('')
  const [motivo,        setMotivo]        = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  // Sincroniza estado con el turno abierto
  useEffect(() => {
    if (!turno) return
    setCurrentRec(turno.recordatorio_minutos_antes ?? null)
    setConfirmAction(null)
    setCalificacion('')
    setMotivo('')
    setRecModalOpen(false)
    setRecSuccess(false)
  }, [turno])

  // Cierra con Escape (solo si no hay confirmación ni sub-modal abiertos)
  useEffect(() => {
    if (!turno) return
    const handler = (e) => {
      if (e.key === 'Escape' && !confirmAction && !recModalOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [turno, onClose, confirmAction, recModalOpen])

  // Ref para achicar el nombre de la empresa si no entra en una línea
  const nombreRef = useRef(null)
  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    // Parte del tamaño que define el CSS (distinto en mobile y desktop)
    el.style.fontSize = ''
    const base = parseInt(window.getComputedStyle(el).fontSize, 10) || 19
    const minSize = window.innerWidth < 480 ? 11 : 13
    let size = base
    el.style.fontSize = `${size}px`
    while (el.scrollWidth > el.offsetWidth && size > minSize) {
      size--
      el.style.fontSize = `${size}px`
    }
  })

  if (!turno) return null

  // ── Estado visible (VENCIDO / EN_HORA son estados virtuales del front) ──
  const ahora       = Date.now()
  const inicioTurno = new Date(turno.fecha_hora).getTime()
  const finTurno    = inicioTurno + turno.duracion * 60 * 1000
  let estadoVisible = turno.estado_turno
  if (turno.estado_turno === 'CONFIRMADO') {
    if      (ahora >= finTurno)    estadoVisible = 'VENCIDO'
    else if (ahora >= inicioTurno) estadoVisible = 'EN_HORA'
  }

  // ── Qué acciones están disponibles ──
  const esCancelable = estadoVisible === 'CONFIRMADO'           // EN_HORA no puede cancelarse
  const esVencido    = estadoVisible === 'VENCIDO'
  const esEnHora     = estadoVisible === 'EN_HORA'
  const ESTADOS_DELETABLES = ['CANCELADO_POR_USUARIO', 'CANCELADO_POR_EMPRESA', 'CUMPLIDO', 'NO_CUMPLIDO']
  const esDeletable  = ESTADOS_DELETABLES.includes(turno.estado_turno)

  // ── Fecha con día en título (primera letra mayúscula) ──
  const fechaDisplay = formatFechaCompleta(turno.fecha_hora)
    .replace(/^[a-záéíóúüñ]+/i, (d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase())

  // ── Dirección (con cortes en cascada: quita provincia y luego departamento si es muy larga) ──
  const dir            = turno.direccion
  const direccionTexto = formatDireccionCascade(dir)
  const mapsUrl = dir?.lat != null && dir?.lng != null
    ? `https://www.google.com/maps?q=${dir.lat},${dir.lng}`
    : null

  // Formatea DNI argentino con puntos: "12345678" → "12.345.678"
  const formatDni = (dni) => {
    if (!dni) return null
    return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const profesional = turno.profesional_apellido
    ? `${turno.profesional_apellido}, ${turno.profesional_nombre}${turno.profesional_dni ? ` (DNI ${formatDni(turno.profesional_dni)})` : ''}`
    : null

  // ── Abre el sub-modal de recordatorio con los valores actuales ──
  const handleAbrirRecModal = () => {
    const min = currentRec
    if (min) {
      setRecEnabled(true)
      setRecH(String(Math.floor(min / 60)))
      setRecM((min % 60) >= 30 ? '30' : '00')
    } else {
      setRecEnabled(false)
      setRecH('')
      setRecM('00')
    }
    setRecError(null)
    setRecSuccess(false)
    setRecModalOpen(true)
  }

  // ── Guarda el recordatorio ──
  const handleGuardarRecordatorio = async () => {
    setRecError(null)
    let minutosFinal = null
    if (recEnabled) {
      const h     = recH === '' ? 0 : parseInt(recH, 10)
      const m     = recM === '' ? 0 : parseInt(recM, 10)
      const total = h * 60 + m
      if (isNaN(h) || h < 0 || h > 23) { setRecError('Horas entre 0 y 23'); return }
      if (total < 30)   { setRecError('Mínimo 30 minutos'); return }
      if (total > 1410) { setRecError('Máximo 23h 30min'); return }
      minutosFinal = total
    }
    setSavingRec(true)
    try {
      await usuarioService.updateRecordatorioTurno(turno.id, minutosFinal)
      setCurrentRec(minutosFinal)  // actualiza el valor mostrado en la fila
      setRecSuccess(true)
    } catch (err) {
      onError(err)
    } finally {
      setSavingRec(false)
    }
  }

  // ── Elimina el turno directamente sin confirmación ──
  const handleDelete = async () => {
    setLoadingAction(true)
    try {
      await usuarioService.deleteTurno(turno.id)
      onDeleted?.(turno.id)
    } catch (err) {
      onError(err)
    } finally {
      setLoadingAction(false)
    }
  }

  // ── Ejecutar acción confirmada (cancelar / cumplido / no cumplido) ──
  const handleConfirmAction = async () => {
    setLoadingAction(true)
    try {
      if (confirmAction === 'cancel') {
        const updated = await usuarioService.updateEstadoTurno(turno.id, {
          estado_turno: 'CANCELADO_POR_USUARIO', motivo: motivo.trim() || null, calificacion: null,
        })
        onCanceled?.(updated)

      } else if (confirmAction === 'cumplido') {
        const cal     = calificacion === '' ? null : parseInt(calificacion, 10)
        const updated = await usuarioService.updateEstadoTurno(turno.id, {
          estado_turno: 'CUMPLIDO', motivo: null, calificacion: cal,
        })
        onUpdated?.(updated)

      } else if (confirmAction === 'no_cumplido') {
        const updated = await usuarioService.updateEstadoTurno(turno.id, {
          estado_turno: 'NO_CUMPLIDO', motivo: null, calificacion: null,
        })
        onUpdated?.(updated)
      }
      setConfirmAction(null)
    } catch (err) {
      onError(err)
    } finally {
      setLoadingAction(false)
    }
  }

  const badgeClass = {
    CONFIRMADO:            'tdmodal__badge--confirmado',
    EN_HORA:               'tdmodal__badge--en-hora',
    VENCIDO:               'tdmodal__badge--vencido',
    CANCELADO_POR_USUARIO: 'tdmodal__badge--cancelado',
    CANCELADO_POR_EMPRESA: 'tdmodal__badge--cancelado',
    CUMPLIDO:              'tdmodal__badge--cumplido',
    NO_CUMPLIDO:           'tdmodal__badge--no-cumplido',
  }[estadoVisible] || 'tdmodal__badge--confirmado'

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal" onClick={(e) => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA sticky: título + cerrar ═══ */}
        <div className="tdmodal__header">
          <h3>Detalle del turno</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="tdmodal__body">

          {/* ── Empresa: logo + nombre a la izquierda, badge a la derecha ── */}
          <div className="tdmodal__empresa">
            <div className="tdmodal__empresa-left">
              <div className="tdmodal__logo">
                {turno.logo_empresa_url
                  ? <img src={turno.logo_empresa_url} alt={turno.sucursal} />
                  : <span>{turno.sucursal.charAt(0)}</span>}
              </div>
              <span ref={nombreRef} className="tdmodal__empresa-nombre" title={turno.sucursal}>
                {turno.sucursal}
              </span>
            </div>
            <span className={`tdmodal__badge ${badgeClass}`}>{labelEstado(estadoVisible)}</span>
          </div>

          {/* ── Filas de información ── */}
          <div className="tdmodal__info">

            {/* 📍 Dirección */}
            {direccionTexto && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">📍</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Dirección:</span>
                  <span className="tdmodal__row-val tdmodal__row-val--dir">
                    <span>{direccionTexto}</span>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                        className="tdmodal__maps-link" onClick={(e) => e.stopPropagation()}
                        aria-label="Ver en Google Maps">
                        <svg className="tdmodal__maps-icon" viewBox="14.32 4.87961494 37.85626587 52.79038506" aria-hidden="true">
                          <path d="m37.34 7.82c-1.68-.53-3.48-.82-5.34-.82-5.43 0-10.29 2.45-13.54 6.31l8.35 7.02z" fill="#1a73e8"/>
                          <path d="m18.46 13.31a17.615 17.615 0 0 0 -4.14 11.36c0 3.32.66 6.02 1.75 8.43l10.74-12.77z" fill="#ea4335"/>
                          <path d="m32 17.92a6.764 6.764 0 0 1 5.16 11.13l10.52-12.51a17.684 17.684 0 0 0 -10.35-8.71l-10.51 12.51a6.74 6.74 0 0 1 5.18-2.42" fill="#4285f4"/>
                          <path d="m32 31.44c-3.73 0-6.76-3.03-6.76-6.76a6.7 6.7 0 0 1 1.58-4.34l-10.75 12.77c1.84 4.07 4.89 7.34 8.03 11.46l13.06-15.52a6.752 6.752 0 0 1 -5.16 2.39" fill="#fbbc04"/>
                          <path d="m36.9 48.8c5.9-9.22 12.77-13.41 12.77-24.13 0-2.94-.72-5.71-1.99-8.15l-23.57 28.05c1 1.31 2.01 2.7 2.99 4.24 3.58 5.54 2.59 8.86 4.9 8.86s1.32-3.33 4.9-8.87" fill="#34a853"/>
                        </svg>
                      </a>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* 📝 Aclaración dirección */}
            {dir?.aclaracion && (
              <div className="tdmodal__row tdmodal__row--sub">
                <span className="tdmodal__row-icon">📝</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Aclaración:</span>
                  <span className="tdmodal__row-val">{dir.aclaracion}</span>
                </div>
              </div>
            )}

            {/* ✂️ Servicio */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">✂️</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Servicio:</span>
                <span className="tdmodal__row-val">{turno.nombre_de_servicio}</span>
              </div>
            </div>

            {/* 📝 Descripción servicio */}
            {turno.aclaracion_de_servicio && (
              <div className="tdmodal__row tdmodal__row--sub">
                <span className="tdmodal__row-icon">📝</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Descripción:</span>
                  <span className="tdmodal__row-val">{turno.aclaracion_de_servicio}</span>
                </div>
              </div>
            )}

            {/* 📅 Fecha y hora */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">📅</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Fecha y hora:</span>
                <span className="tdmodal__row-val">{fechaDisplay}</span>
              </div>
            </div>

            {/* ⏱️ Duración */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">⏱️</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Duración:</span>
                <span className="tdmodal__row-val">{formatDuracionLarga(turno.duracion)}</span>
              </div>
            </div>

            {/* 💲 Precio */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">💲</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Precio:</span>
                <span className="tdmodal__row-val">${Number(turno.precio).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* 💼 Profesional */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">💼</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Profesional:</span>
                <span className="tdmodal__row-val">{profesional ?? '—'}</span>
              </div>
            </div>

            {/* ⏰ Recordatorio — oculto en modo solo lectura (historial) */}
            {!readOnly && (
              <div className="tdmodal__row tdmodal__row--rec">
                <span className="tdmodal__row-icon">⏰</span>
                <div className="tdmodal__row-body tdmodal__row-body--rec">
                  <span className="tdmodal__row-label">Recordatorio:</span>
                  <span className="tdmodal__row-val tdmodal__rec-val">{formatRecDisplay(currentRec)}</span>
                  {estadoVisible === 'CONFIRMADO' && (
                    <button className="tdmodal__btn-rec-edit" onClick={handleAbrirRecModal} type="button">
                      Cambiar
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ═══ ACCIONES según estado (Cerrar siempre primero/izquierda) ═══ */}
        <div className="tdmodal__actions">

          {/* Solo lectura (historial): únicamente Cerrar */}
          {readOnly && (
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          )}

          {/* CONFIRMADO: Cerrar + Cancelar turno (rojo) */}
          {!readOnly && esCancelable && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn-danger" onClick={() => { setMotivo(''); setConfirmAction('cancel') }}>
                Cancelar turno
              </button>
            </>
          )}

          {/* EN_HORA: solo Cerrar */}
          {!readOnly && esEnHora && (
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          )}

          {/* VENCIDO: Cerrar + Cumplido (orange) + No cumplido (indigo) */}
          {!readOnly && esVencido && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn-orange" onClick={() => setConfirmAction('cumplido')}>
                Cumplido
              </button>
              <button className="btn btn-indigo" onClick={() => setConfirmAction('no_cumplido')}>
                No cumplido
              </button>
            </>
          )}

          {/* CANCELADO / CUMPLIDO / NO_CUMPLIDO: Cerrar + Eliminar (rojo, directo) */}
          {!readOnly && esDeletable && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={loadingAction}>
                {loadingAction ? <span className="spinner spinner-sm" /> : 'Eliminar'}
              </button>
            </>
          )}

        </div>
      </div>

      {/* ═══ CONFIRM MODAL: cancelar turno ═══ */}
      {confirmAction === 'cancel' && (
        <ConfirmModal
          icon="🚫"
          message="¿Confirmás la cancelación del turno?"
          confirmText="Sí, cancelar"
          confirmVariant="btn-danger"
          loading={loadingAction}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        >
          <div className="tdmodal__motivo">
            <label className="tdmodal__motivo-label">Motivo (opcional):</label>
            <textarea
              className="tdmodal__motivo-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ingresá un motivo..."
              maxLength={255}
              rows={3}
              disabled={loadingAction}
            />
          </div>
        </ConfirmModal>
      )}


      {/* ═══ CONFIRM MODAL: no cumplido ═══ */}
      {confirmAction === 'no_cumplido' && (
        <ConfirmModal
          icon="❌"
          message="¿Marcar este turno como no cumplido?"
          confirmText="Confirmar"
          confirmVariant="btn-indigo"
          loading={loadingAction}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ═══ MODAL CALIFICACIÓN: cumplido ═══ */}
      {confirmAction === 'cumplido' && (
        <ConfirmModal
          icon="✅"
          message="¿Marcar este turno como cumplido?"
          confirmText="Enviar"
          confirmVariant="btn-orange"
          loading={loadingAction}
          loadingText="Enviando..."
          onConfirm={handleConfirmAction}
          onCancel={() => { setConfirmAction(null); setCalificacion('') }}
        >
          {/* Calificación opcional */}
          <div className="tdmodal__rating">
            <label className="tdmodal__rating-label">Calificación (opcional):</label>
            <CustomSelect
              options={[
                { value: '', label: '' },
                ...[0,1,2,3,4,5,6,7,8,9,10].map((n) => ({ value: String(n), label: String(n) })),
              ]}
              value={calificacion}
              onChange={(val) => setCalificacion(val)}
              width={45}
              height={33}
            />
          </div>
        </ConfirmModal>
      )}

      {/* ═══ SUB-MODAL: edición de recordatorio ═══ */}
      {recModalOpen && (
        <div className="tdmodal-rec-overlay">
          <div className="tdmodal-rec-modal">

            <button className="cmodal__close" onClick={() => setRecModalOpen(false)} disabled={savingRec} aria-label="Cerrar" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {!recSuccess ? (
              <>
                <h4 className="tdmodal-rec-modal__title">⏰ Recordatorio</h4>
                <RecordatorioField
                  enabled={recEnabled}
                  hours={recH}
                  minutes={recM}
                  onEnabledChange={setRecEnabled}
                  onHoursChange={setRecH}
                  onMinutesChange={setRecM}
                  disabled={savingRec}
                  error={recError}
                />
                <div className="tdmodal-rec-modal__btns">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setRecModalOpen(false)}
                    disabled={savingRec}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleGuardarRecordatorio}
                    disabled={savingRec}
                  >
                    {savingRec ? <span className="spinner spinner-sm" /> : 'Guardar'}
                  </button>
                </div>
              </>
            ) : (
              /* Mensaje de éxito */
              <>
                <div className="tdmodal-rec-modal__success">
                  <span className="tdmodal-rec-modal__success-icon">✅</span>
                  <p className="tdmodal-rec-modal__success-msg">Recordatorio guardado correctamente</p>
                </div>
                <div className="tdmodal-rec-modal__btns">
                  <button
                    className="btn btn-primary"
                    onClick={() => { setRecModalOpen(false); setRecSuccess(false) }}
                  >
                    Aceptar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
