import { useState, useEffect, useRef } from 'react'
import { scrollToFirstError } from '../../utils/validation'
import { sucursalService } from '../../services/sucursalService'
import ErrorModal from '../ErrorModal/ErrorModal'
import HorariosModal from '../HorariosModal/HorariosModal'
import DateInput from '../DateInput/DateInput'
import CustomSelect from '../CustomSelect/CustomSelect'
import '../ServicioModal/ServicioModal.css'
import './CrearServicioModal.css'

/**
 * Construye la lista de miembros únicos combinando miembros_empresa y miembros_sucursales.
 */
function buildMiembrosList(miembros) {
  if (!miembros) return []
  const map = new Map()
  ;(miembros.miembros_empresa ?? []).forEach(({ miembro }) => {
    if (miembro && !map.has(miembro.id)) map.set(miembro.id, miembro)
  })
  ;(miembros.miembros_sucursales ?? []).forEach(({ miembro }) => {
    if (miembro && !map.has(miembro.id)) map.set(miembro.id, miembro)
  })
  return Array.from(map.values())
}

/**
 * Devuelve la fecha de mañana en formato YYYY-MM-DD usando la hora LOCAL del usuario.
 * No usa toISOString() porque eso devuelve UTC y puede adelantar un día en zonas UTC-.
 */
function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Validaciones del formulario de creación.
 */
function validateForm(fields) {
  const errors = {}

  // Nombre: requerido, 1-100 chars
  const nombre = (fields.nombre ?? '').trim()
  if (!nombre) {
    errors.nombre = 'El nombre es requerido'
  } else if (nombre.length > 100) {
    errors.nombre = 'El nombre no puede superar los 100 caracteres'
  }

  // Duración: requerida, >0, múltiplo de 5
  const duracion = fields.duracion === '' ? NaN : Number(fields.duracion)
  if (isNaN(duracion) || duracion <= 0) {
    errors.duracion = 'La duración es requerida y debe ser mayor a 0'
  } else if (duracion % 5 !== 0) {
    errors.duracion = 'La duración debe ser múltiplo de 5 minutos'
  }

  // Precio: requerido, >=0, max 10 dígitos, max 2 decimales
  const precioRaw = fields.precio
  if (precioRaw === '' || precioRaw == null) {
    errors.precio = 'El precio es requerido y debe ser mayor o igual a 0'
  } else {
    const num = Number(precioRaw)
    if (isNaN(num) || num < 0) {
      errors.precio = 'El precio es requerido y debe ser mayor o igual a 0'
    } else {
      const str = String(precioRaw).replace(',', '.')
      const [intPart, decPart] = str.split('.')
      const totalDigits = (intPart?.replace('-', '').length ?? 0) + (decPart?.length ?? 0)
      if (totalDigits > 10) errors.precio = 'El precio no puede superar los 10 dígitos en total'
      else if (decPart && decPart.length > 2) errors.precio = 'El precio no puede tener más de 2 decimales'
    }
  }

  // Vigente desde: requerido, al menos mañana
  if (!fields.vigente_desde) {
    errors.vigente_desde = 'La fecha de inicio es requerida'
  } else if (fields.vigente_desde < getTomorrow()) {
    errors.vigente_desde = 'La fecha de inicio debe ser al menos mañana'
  }

  // Vigente hasta: si se ingresa, debe ser ESTRICTAMENTE mayor a vigente_desde
  if (fields.vigente_hasta && fields.vigente_desde && fields.vigente_hasta <= fields.vigente_desde) {
    errors.vigente_hasta = 'La fecha de fin debe ser posterior a la de inicio'
  }

  // Anticipación mínima de reserva: horas >= 0 entero, minutos 0-59 entero
  const horasVal = fields.horas_min !== '' ? Number(fields.horas_min) : 0
  const minsVal  = fields.mins_min  !== '' ? Number(fields.mins_min)  : 0
  if (isNaN(horasVal) || horasVal < 0 || !Number.isInteger(horasVal)) {
    errors.horas_min = 'Debe ser un número entero mayor o igual a 0'
  }
  if (isNaN(minsVal) || minsVal < 0 || minsVal > 59 || !Number.isInteger(minsVal)) {
    errors.mins_min = 'Debe ser entre 0 y 59'
  }

  // Límite de días para reservar: >=0 o vacío (sin límite)
  if (fields.limite_dias_reserva !== '' && fields.limite_dias_reserva !== null) {
    const val = Number(fields.limite_dias_reserva)
    if (isNaN(val) || val < 0) {
      errors.limite_dias_reserva = 'Debe ser un número mayor o igual a 0'
    }
  }

  // Aclaración: max 255 chars
  if (fields.aclaracion && fields.aclaracion.length > 255) {
    errors.aclaracion = 'La aclaración no puede superar los 255 caracteres'
  }

  return errors
}

/**
 * Modal para crear un nuevo servicio en una sucursal.
 *
 * Props:
 *   sucursalId  — id de la sucursal
 *   miembros    — MiembrosEmpresaOut (puede ser null)
 *   onClose     — callback al cerrar sin cambios
 *   onCreated   — callback(servicioNuevo) al crear exitosamente
 */
export default function CrearServicioModal({ sucursalId, miembros, onClose, onCreated }) {
  const miembrosList = buildMiembrosList(miembros)

  // Campos del formulario
  const [nombre,              setNombre]              = useState('')
  const [duracion,            setDuracion]            = useState('')
  const [precio,              setPrecio]              = useState('')
  const [aclaracion,          setAclaracion]          = useState('')
  const [profesionalId,       setProfesionalId]       = useState('')
  const [vigente_desde,       setVigenteDesde]        = useState(getTomorrow())
  const [vigente_hasta,       setVigenteHasta]        = useState('')
  const [minTimeEnabled,      setMinTimeEnabled]      = useState(false)
  const [horasMin,            setHorasMin]            = useState('')
  const [minsMin,             setMinsMin]             = useState('')
  const [diasMax,             setDiasMax]             = useState('')
  const [cancelacionLimitada, setCancelacionLimitada] = useState(false)
  const [disponibilidades,    setDisponibilidades]    = useState([])

  // UI
  const [formErrors,   setFormErrors]   = useState({})
  const [saving,       setSaving]       = useState(false)
  const [backError,    setBackError]    = useState(null)
  const [horariosOpen, setHorariosOpen] = useState(false)
  const [helpOpen,     setHelpOpen]     = useState(false)

  const firstInputRef = useRef(null)

  // Cierra con Escape (solo si el modal de horarios no está abierto)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !horariosOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, horariosOpen])

  // Foco inicial
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  /**
   * Envía el formulario al back para crear el servicio.
   */
  const handleConfirm = async () => {
    const fields = {
      nombre,
      duracion,
      precio,
      aclaracion,
      vigente_desde,
      vigente_hasta,
      horas_min:        horasMin,
      mins_min:         minsMin,
      limite_dias_reserva: diasMax,
    }
    const errors = validateForm(fields)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      scrollToFirstError()
      return
    }
    setFormErrors({})

    // Validación adicional: si el tiempo mínimo está activado, ambos campos son obligatorios
    if (minTimeEnabled && (horasMin === '' || minsMin === '')) {
      setBackError({ message: 'Si activás el tiempo mínimo de reserva, debés completar tanto las horas como los minutos.' })
      return
    }

    // Construir payload
    const payload = {
      nombre:               nombre.trim(),
      duracion:             Number(duracion),
      precio:               Number(precio),
      aclaracion:           aclaracion.trim() || null,
      profesional_id:       profesionalId !== '' ? Number(profesionalId) : null,
      vigente_desde,
      vigente_hasta:        vigente_hasta || null,
      minutos_minimos_anticipacion_reserva: minTimeEnabled
        ? (horasMin !== '' ? Math.max(0, Number(horasMin)) : 0) * 60 +
          (minsMin  !== '' ? Math.max(0, Number(minsMin))  : 0)
        : 0,
      limite_dias_reserva:     diasMax !== '' ? Number(diasMax) : null,
      cancelacion_turno_limitada: cancelacionLimitada,
      disponibilidades,
    }

    setSaving(true)
    try {
      const created = await sucursalService.createServicio(sucursalId, payload)
      onCreated(created)
    } catch (err) {
      setBackError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Overlay del modal */}
      <div
        className="sm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Crear servicio"
        onClick={onClose}
      >
        <div className="sm-card" onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="sm-header">
            <span className="csm-title">Nuevo Servicio</span>
            <button className="csm-btn-help" onClick={() => setHelpOpen((v) => !v)} type="button" aria-label="Ayuda">
              <span className="csm-btn-help__icon">?</span>
              Ayuda
            </button>
            <button className="sm-header__close" onClick={onClose} aria-label="Cerrar modal" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6"  x2="6"  y2="18"/>
                <line x1="6"  y1="6"  x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ── Panel de ayuda ── */}
          {helpOpen && (
            <div className="csm-help">
              <p className="csm-help__section-title">Datos principales</p>
              <p className="csm-help__text">
                Son los datos principales que identifican al servicio: nombre, profesional, reglas de reserva y cancelación.<br /><br />
                <strong>Nombre</strong>: Identificador del servicio, máximo 100 caracteres. Si se desea que un mismo servicio tenga distintos profesionales, debe crearse otro servicio con el mismo nombre y distinto profesional.<br /><br />
                <strong>Profesional asignado</strong>: Miembro responsable del servicio. Si el servicio no requiere profesional, puede dejarse sin uno.<br /><br />
                <strong>Cancelación limitada</strong>: Cuando está activa, solo el profesional asignado o sus superiores pueden cancelar un turno. Requiere tener un profesional asignado.<br /><br />
                <strong>Tiempo mínimo de reserva</strong>: Anticipación mínima que necesita el cliente para reservar. Ej: "2 horas" impide reservar con menos de 2 horas de antelación. Dejalo deshabilitado para no tener límite.<br /><br />
                <strong>Límite de días</strong>: Cuántos días a futuro puede el cliente ver y reservar turnos. Dejá vacío para no tener límite.<br /><br />
                <strong>Aclaración</strong>: Texto libre visible para el cliente con información adicional (máx. 255 caracteres).
              </p>
              <p className="csm-help__section-title">Datos de versión del servicio</p>
              <p className="csm-help__text">
                Cada versión tiene un período de vigencia, precio, duración y horarios. Cuando necesites cambiar la fecha de vigencia final, el precio u horarios, podés crear una nueva versión que comience a partir de otra fecha posterior, sin perder la versión actual.<br /><br />
                <strong>Duración</strong>: Duración de cada turno en minutos. Debe ser mayor a 0 y múltiplo de 5 (ej: 15, 30, 45, 60).<br /><br />
                <strong>Precio</strong>: Precio del servicio en pesos. Puede ser 0 si es gratuito. Máximo 10 dígitos con 2 decimales.<br /><br />
                <strong>Vigente desde</strong>: Fecha a partir de la cual esta versión está activa. Debe ser al menos mañana.<br /><br />
                <strong>Vigente hasta</strong>: Opcional. Si se deja vacío, la versión no tiene fecha de vencimiento. Debe ser mayor o igual a "Vigente desde".<br /><br />
                <strong>Franja horaria (inicio → fin)</strong>: El rango de horas en que se ofrecen turnos. Tanto el inicio como el fin son turnos válidos. Ambos deben ser múltiplo de 5 minutos (ej: 8:00, 9:15, 10:30).
                <br />Usá el botón "Configurar horarios" para agregar los horarios disponibles.<br /><br />
                <strong>Salto (intervalo)</strong>: Cada cuántos minutos se genera un turno dentro de la franja. Debe ser múltiplo de 5 y la duración total de la franja debe ser divisible por él. Ej: franja 8:00→9:00 con salto 30 genera los turnos 8:00, 8:30 y 9:00. Si además querés turnos cada 15 minutos desde las 9:15 hasta las 10:00, agregá una segunda franja 9:15→10:00 con salto 15 — que suma los turnos (9:15, 9:30, 9:45 y 10:00).<br /><br />
                <strong>Turnos simultáneos</strong>: Cuántos clientes distintos pueden reservar el mismo horario al mismo tiempo. Útil para clases grupales o servicios con múltiples puestos. Mínimo 0.
              </p>
            </div>
          )}

          {/* ── Cuerpo ── */}
          <div className="sm-body">

            {/* ── SECCIÓN: Datos principales del servicio (ServicioBase) ── */}
            <div className="csm-section-label">Datos principales</div>

            {/* Nombre (full width) */}
            <div className="sm-field sm-field--full">
              <label className="sm-field__label">
                Nombre <span className="csm-required">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                className="sm-field__input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del servicio"
                maxLength={100}
              />
              {formErrors.nombre && (
                <span className="sm-field__error">{formErrors.nombre}</span>
              )}
            </div>

            <div className="sm-form-grid">

              {/* Tiempo mínimo para reserva de turnos — toggle + horas + minutos */}
              <div className="sm-field">
                <label className="sm-field__label">Tiempo mínimo para reserva de turnos</label>
                <div className="sm-dual-input">
                  {/* Toggle para habilitar/deshabilitar el tiempo mínimo */}
                  <label className="sm-toggle">
                    <input
                      type="checkbox"
                      className="sm-toggle__input"
                      checked={minTimeEnabled}
                      onChange={(e) => {
                        setMinTimeEnabled(e.target.checked)
                        if (!e.target.checked) { setHorasMin(''); setMinsMin('') }
                      }}
                    />
                    <span className="sm-toggle__track" />
                  </label>
                  <div className="sm-dual-input__field sm-dual-input__field--hours">
                    <input
                      type="number"
                      className="sm-field__input"
                      value={horasMin}
                      onChange={(e) => setHorasMin(e.target.value)}
                      min={0}
                      placeholder="0"
                      disabled={!minTimeEnabled}
                    />
                    <span className="sm-dual-input__unit">horas</span>
                  </div>
                  <div className="sm-dual-input__field sm-dual-input__field--mins">
                    <input
                      type="number"
                      className="sm-field__input"
                      value={minsMin}
                      onChange={(e) => {
                        // Máximo 2 dígitos (00-59)
                        const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                        setMinsMin(val)
                      }}
                      min={0}
                      max={59}
                      placeholder="00"
                      disabled={!minTimeEnabled}
                    />
                    <span className="sm-dual-input__unit">minutos</span>
                  </div>
                </div>
                {(formErrors.horas_min || formErrors.mins_min) && (
                  <span className="sm-field__error">{formErrors.horas_min || formErrors.mins_min}</span>
                )}
              </div>

              {/* Límite de días para reserva de turnos */}
              <div className="sm-field">
                <label className="sm-field__label">Límite de días para reserva de turnos</label>
                <input
                  type="number"
                  className="sm-field__input"
                  value={diasMax}
                  onChange={(e) => setDiasMax(e.target.value)}
                  min={0}
                  placeholder="Sin límite"
                />
                {formErrors.limite_dias_reserva && (
                  <span className="sm-field__error">{formErrors.limite_dias_reserva}</span>
                )}
              </div>

              {/* Profesional */}
              <div className="sm-field">
                <label className="sm-field__label">Profesional asignado</label>
                <CustomSelect
                  options={[
                    { value: '', label: 'Sin profesional' },
                    ...miembrosList.map((m) => ({ value: String(m.id), label: `${m.apellido}, ${m.nombre}` })),
                  ]}
                  value={profesionalId}
                  onChange={(val) => setProfesionalId(val)}
                  width="100%"
                  height={39}
                />
              </div>

              {/* Cancelación de turno limitada — solo activo si hay profesional */}
              <div className="sm-field">
                <label className="sm-field__label">Cancelación de turno limitada</label>
                <div className="sm-toggle-row">
                  <label className={`sm-toggle ${!profesionalId ? 'sm-toggle--disabled' : ''}`}>
                    <input
                      type="checkbox"
                      className="sm-toggle__input"
                      checked={cancelacionLimitada}
                      onChange={(e) => setCancelacionLimitada(e.target.checked)}
                      disabled={!profesionalId}
                    />
                    <span className="sm-toggle__track" />
                  </label>
                  <span className="sm-toggle-desc">
                    Solo puede cancelar el profesional o sus superiores
                  </span>
                </div>
              </div>

            </div>

            {/* Aclaración */}
            <div className="sm-field sm-field--full">
              <label className="sm-field__label">Aclaración</label>
              <textarea
                className="sm-field__textarea"
                value={aclaracion}
                onChange={(e) => setAclaracion(e.target.value)}
                placeholder="Información adicional sobre el servicio (opcional)"
                maxLength={255}
                rows={3}
              />
              <span className={`sm-field__char-count ${aclaracion.length > 230 ? 'sm-field__char-count--warn' : ''}`}>
                {aclaracion.length}/255
              </span>
              {formErrors.aclaracion && (
                <span className="sm-field__error">{formErrors.aclaracion}</span>
              )}
            </div>

            {/* ── SECCIÓN: Versión del servicio (Servicio) ── */}
            <div className="csm-section-label">Datos de versión del servicio</div>

            <div className="sm-form-grid">

              {/* Duración */}
              <div className="sm-field">
                <label className="sm-field__label">
                  Duración <span className="sm-hint">(múltiplo de 5 min)</span> <span className="csm-required">*</span>
                </label>
                <input
                  type="number"
                  className="sm-field__input"
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  min={5}
                  step={5}
                  placeholder="ej: 30"
                />
                {formErrors.duracion && (
                  <span className="sm-field__error">{formErrors.duracion}</span>
                )}
              </div>

              {/* Precio */}
              <div className="sm-field">
                <label className="sm-field__label">
                  Precio ($) <span className="csm-required">*</span>
                </label>
                <input
                  type="number"
                  className="sm-field__input"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="ej: 5000"
                />
                {formErrors.precio && (
                  <span className="sm-field__error">{formErrors.precio}</span>
                )}
              </div>

              {/* Vigente desde */}
              <div className="sm-field">
                <label className="sm-field__label">
                  Vigente desde <span className="csm-required">*</span>
                </label>
                <DateInput
                  value={vigente_desde}
                  onChange={(e) => setVigenteDesde(e.target.value)}
                  min={getTomorrow()}
                  className="sm-field__input"
                />
                {formErrors.vigente_desde && (
                  <span className="sm-field__error">{formErrors.vigente_desde}</span>
                )}
              </div>

              {/* Vigente hasta */}
              <div className="sm-field">
                <label className="sm-field__label">Vigente hasta</label>
                <DateInput
                  value={vigente_hasta}
                  onChange={(e) => setVigenteHasta(e.target.value)}
                  className="sm-field__input"
                />
                {formErrors.vigente_hasta && (
                  <span className="sm-field__error">{formErrors.vigente_hasta}</span>
                )}
              </div>

            </div>

            {/* Botón configurar horarios */}
            <button
              className="sm-btn-horarios"
              onClick={() => setHorariosOpen(true)}
              type="button"
              disabled={saving}
            >
              <svg className="sm-btn-horarios__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Configurar horarios
              {disponibilidades.length > 0 && (
                <span className="csm-horarios-count">{disponibilidades.length} franja{disponibilidades.length !== 1 ? 's' : ''}</span>
              )}
            </button>

          </div>

          {/* ── Footer ── */}
          <div className="sm-footer">
            <button
              className="btn sm-footer__btn sm-footer__btn--cancel"
              onClick={onClose}
              disabled={saving}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="btn sm-footer__btn sm-footer__btn--confirm"
              onClick={handleConfirm}
              disabled={saving}
              type="button"
            >
              {saving ? 'Creando...' : 'Crear servicio'}
            </button>
          </div>

        </div>
      </div>

      {/* Modal de horarios */}
      {horariosOpen && (
        <HorariosModal
          disponibilidades={disponibilidades}
          onClose={() => setHorariosOpen(false)}
          onSave={(disp) => { setDisponibilidades(disp); setHorariosOpen(false) }}
        />
      )}

      {/* Modal de errores del back */}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </>
  )
}
