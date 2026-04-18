import { useState, useEffect, useRef } from 'react'
import { sucursalService } from '../../services/sucursalService'
import { formatDuracion, getVersionActiva } from '../../utils/dateUtils'
import ErrorModal from '../ErrorModal/ErrorModal'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import VersionModal from '../VersionModal/VersionModal'
import BloqueoModal from '../BloqueoModal/BloqueoModal'
import CustomSelect from '../CustomSelect/CustomSelect'
import './ServicioModal.css'

/**
 * Construye la lista de miembros únicos para el selector de profesional:
 * - Todos los miembros globales de la empresa (PROPIETARIO, GERENTE_EMPRESA)
 * - Solo los miembros de sucursal que pertenecen a la sucursal específica
 */
function buildMiembrosList(miembros, sucursalId) {
  if (!miembros) return []
  const map = new Map()
  // Miembros globales de la empresa
  ;(miembros.miembros_empresa ?? []).forEach(({ miembro }) => {
    if (miembro && !map.has(miembro.id)) map.set(miembro.id, miembro)
  })
  // Miembros de sucursal: solo los que pertenecen a esta sucursal
  ;(miembros.miembros_sucursales ?? []).forEach(({ miembro, sucursales }) => {
    const perteneceASucursal = (sucursales ?? []).some((s) => s.id === sucursalId)
    if (miembro && perteneceASucursal && !map.has(miembro.id)) map.set(miembro.id, miembro)
  })
  return Array.from(map.values())
}

/** Formatea fecha "YYYY-MM-DD" a "DD/MM/YYYY" para mostrar al usuario. */
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}


/**
 * Validaciones del formulario base antes de enviar.
 */
function validateForm(fields) {
  const errors = {}

  const nombre = (fields.nombre ?? '').trim()
  if (!nombre) {
    errors.nombre = 'El nombre es requerido'
  } else if (nombre.length > 100) {
    errors.nombre = 'El nombre no puede superar los 100 caracteres'
  }

  const horasVal = fields.horas_min !== '' ? Number(fields.horas_min) : 0
  const minsVal  = fields.mins_min  !== '' ? Number(fields.mins_min)  : 0
  if (isNaN(horasVal) || horasVal < 0 || !Number.isInteger(horasVal)) {
    errors.horas_min = 'Debe ser un número entero mayor o igual a 0'
  }
  if (isNaN(minsVal) || minsVal < 0 || minsVal > 59 || !Number.isInteger(minsVal)) {
    errors.mins_min = 'Debe ser entre 0 y 59'
  }

  if (fields.limite_dias_reserva !== '' && fields.limite_dias_reserva !== null) {
    const val = Number(fields.limite_dias_reserva)
    if (isNaN(val) || val < 0) {
      errors.limite_dias_reserva = 'Debe ser un número mayor o igual a 0'
    }
  }

  if (fields.aclaracion && fields.aclaracion.length > 255) {
    errors.aclaracion = 'La aclaración no puede superar los 255 caracteres'
  }

  return errors
}

/**
 * Tarjeta visual de resumen de una versión.
 * Usada tanto en borradores (create mode) como en versiones reales (edit mode).
 */
function VersionCard({ v, onEdit }) {
  const franjas = (v.disponibilidades ?? []).length
  return (
    <div className="sm-version-card" onClick={onEdit} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onEdit()}>
      <div className="sm-version-card__chips">
        <span className="sm-version-card__chip">{formatDuracion(v.duracion)}</span>
        <span className="sm-version-card__chip">${Number(v.precio).toLocaleString('es-AR')}</span>
        <span className="sm-version-card__chip">
          Desde {formatDate(v.vigente_desde)}
        </span>
        <span className={`sm-version-card__chip${!v.vigente_hasta ? ' sm-version-card__chip--muted' : ''}`}>
          {v.vigente_hasta ? `Hasta ${formatDate(v.vigente_hasta)}` : 'Sin fecha de fin'}
        </span>
        {franjas > 0 && (
          <span className="sm-version-card__chip">
            {franjas} franja{franjas !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Modal unificado para crear y editar un servicio de sucursal.
 *
 * Props:
 *   servicio    — ServicioBaseOut existente, o null para crear uno nuevo
 *   sucursalId  — id de la sucursal
 *   miembros    — MiembrosEmpresaOut (puede ser null)
 *   onClose     — callback al cerrar sin cambios
 *   onSaved     — callback(servicioNuevo) al crear exitosamente
 *   onUpdated   — callback(servicioActualizado) al guardar cambios
 *   onDeleted   — callback(servicioBaseId) al eliminar
 */
export default function ServicioModal({ servicio, sucursalId, miembros, onClose, onSaved, onUpdated, onVersionUpdated, onDeleted }) {
  const isCreate     = !servicio
  const miembrosList = buildMiembrosList(miembros, sucursalId)

  // ── Estado compartido ──
  const [nombre,              setNombre]              = useState(servicio?.nombre ?? '')
  const [aclaracion,          setAclaracion]          = useState(servicio?.aclaracion ?? '')
  const origMin = servicio?.minutos_minimos_anticipacion_reserva ?? 0
  const [minTimeEnabled,      setMinTimeEnabled]      = useState(origMin > 0)
  const [horasMin,            setHorasMin]            = useState(origMin > 0 ? String(Math.floor(origMin / 60)) : '')
  const [minsMin,             setMinsMin]             = useState(origMin > 0 ? String(origMin % 60) : '')
  const [diasMax,             setDiasMax]             = useState(
    servicio?.limite_dias_reserva != null ? String(servicio.limite_dias_reserva) : ''
  )
  const [cancelacionLimitada, setCancelacionLimitada] = useState(servicio?.cancelacion_turno_limitada ?? false)

  // ── Estado exclusivo de creación ──
  const [profesionalId,    setProfesionalId]    = useState('')
  const [pendingVersiones, setPendingVersiones] = useState([])  // borradores de versión

  // ── Estado de UI ──
  const [formErrors,       setFormErrors]       = useState({})
  const [saving,           setSaving]           = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [backError,        setBackError]        = useState(null)
  // backSuccess: { message, onAccept } — al aceptar ejecuta onAccept y cierra el modal de éxito
  const [backSuccess,      setBackSuccess]      = useState(null)
  const [helpOpen,         setHelpOpen]         = useState(false)
  const [versionModalOpen, setVersionModalOpen] = useState(false)
  const [editingVersion,   setEditingVersion]   = useState(null) // null | number (idx pending) | version object
  const [bloqueoModalOpen, setBloqueoModalOpen] = useState(false)
  // Copia local de los bloqueos del servicio (se actualiza sin recargar todo el servicio)
  const [bloqueos,         setBloqueos]         = useState(servicio?.excepciones_fechas ?? [])

  const firstInputRef = useRef(null)

  // Cierra con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !versionModalOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, versionModalOpen])

  useEffect(() => { firstInputRef.current?.focus() }, [])

  // Profesional efectivo: editable en create, fijo en edit
  const efectivoProfesionalId = isCreate ? profesionalId : (servicio?.profesional_id ?? '')

  /** Abre el VersionModal para crear o editar una versión. */
  const openVersionModal = (versionOrIdx) => {
    setEditingVersion(versionOrIdx)
    setVersionModalOpen(true)
  }

  /**
   * Guarda una versión pendiente (create mode).
   * editingVersion es null (nueva) o un índice numérico (editar pendiente).
   */
  const handlePendingVersionSave = (data) => {
    if (typeof editingVersion === 'number') {
      setPendingVersiones((prev) => prev.map((v, i) => i === editingVersion ? data : v))
    } else {
      setPendingVersiones((prev) => [...prev, data])
    }
    setVersionModalOpen(false)
  }

  /**
   * Guarda una versión desde el modal en edit mode.
   * editingVersion es null (nueva versión) o un objeto versión existente.
   *
   * - createVersion  devuelve ServicioBaseOut (servicio completo con versiones)
   * - updateServicioVersion devuelve ServicioOut (solo la versión actualizada),
   *   por lo que debemos reconstruir el objeto completo del servicio manualmente.
   */
  const handleSaveVersion = async (data) => {
    setSaving(true)
    try {
      let updated
      if (!editingVersion) {
        // Crear nueva versión → el back devuelve el servicio completo
        updated = await sucursalService.createVersion(sucursalId, servicio.id, data)
      } else {
        // Editar versión existente — solo precio, vigente_hasta, disponibilidades
        const payload = {
          precio:           data.precio,
          vigente_hasta:    data.vigente_hasta,
          disponibilidades: data.disponibilidades,
        }
        // El back devuelve solo la versión actualizada (ServicioOut), no el servicio completo
        const updatedVersion = await sucursalService.updateServicioVersion(
          sucursalId, servicio.id, editingVersion.id, payload
        )
        // Reconstruimos el objeto completo del servicio reemplazando la versión editada
        updated = {
          ...servicio,
          servicios: (servicio.servicios ?? []).map((v) =>
            v.id === editingVersion.id ? updatedVersion : v
          ),
        }
      }
      setBackSuccess({
        message: 'Versión guardada exitosamente.',
        onAccept: () => { setVersionModalOpen(false); onVersionUpdated(updated) },
      })
    } catch (err) {
      setBackError(err)
    } finally {
      setSaving(false)
    }
  }

  /** Crea el servicio base con la primera versión. */
  const handleCreate = async () => {
    if (pendingVersiones.length === 0) {
      setBackError({ message: 'Debés agregar una versión del servicio antes de crear.' })
      return
    }

    const fields = { nombre, aclaracion, horas_min: horasMin, mins_min: minsMin, limite_dias_reserva: diasMax }
    const errors = validateForm(fields)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    setFormErrors({})

    if (minTimeEnabled && (horasMin === '' || minsMin === '')) {
      setBackError({ message: 'Si activás el tiempo mínimo de reserva, debés completar tanto las horas como los minutos.' })
      return
    }

    const v = pendingVersiones[0]
    const payload = {
      nombre:               nombre.trim(),
      aclaracion:           aclaracion.trim() || null,
      profesional_id:       profesionalId !== '' ? Number(profesionalId) : null,
      minutos_minimos_anticipacion_reserva: minTimeEnabled
        ? (horasMin !== '' ? Math.max(0, Number(horasMin)) : 0) * 60 +
          (minsMin  !== '' ? Math.max(0, Number(minsMin))  : 0)
        : 0,
      limite_dias_reserva:       diasMax !== '' ? Number(diasMax) : null,
      cancelacion_turno_limitada: cancelacionLimitada,
      duracion:       v.duracion,
      precio:         v.precio,
      vigente_desde:  v.vigente_desde,
      vigente_hasta:  v.vigente_hasta,
      disponibilidades: v.disponibilidades,
    }

    setSaving(true)
    try {
      const created = await sucursalService.createServicio(sucursalId, payload)
      // Si hay una segunda versión pendiente, crearla aparte
      if (pendingVersiones.length >= 2) {
        const v2 = pendingVersiones[1]
        await sucursalService.createVersion(sucursalId, created.id, {
          duracion:         v2.duracion,
          precio:           v2.precio,
          vigente_desde:    v2.vigente_desde,
          vigente_hasta:    v2.vigente_hasta,
          disponibilidades: v2.disponibilidades,
        })
      }
      setBackSuccess({ message: 'Servicio creado exitosamente.', onAccept: () => onSaved(created) })
    } catch (err) {
      setBackError(err)
    } finally {
      setSaving(false)
    }
  }

  /** Edita el servicio base enviando solo los campos modificados. */
  const handleUpdate = async () => {
    const fields = { nombre, aclaracion, horas_min: horasMin, mins_min: minsMin, limite_dias_reserva: diasMax }
    const errors = validateForm(fields)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    setFormErrors({})

    if (minTimeEnabled && (horasMin === '' || minsMin === '')) {
      setBackError({ message: 'Si activás el tiempo mínimo de reserva, debés completar tanto las horas como los minutos.' })
      return
    }

    const payload = {}
    const trimmedNombre = nombre.trim()
    if (trimmedNombre !== (servicio.nombre ?? '')) payload.nombre = trimmedNombre

    const trimmedAclaracion = aclaracion.trim() || null
    if (trimmedAclaracion !== (servicio.aclaracion ?? null)) payload.aclaracion = trimmedAclaracion

    const newMinutos = minTimeEnabled
      ? (horasMin !== '' ? Math.max(0, Number(horasMin)) : 0) * 60 +
        (minsMin  !== '' ? Math.max(0, Number(minsMin))  : 0)
      : 0
    if (newMinutos !== (servicio.minutos_minimos_anticipacion_reserva ?? 0)) {
      payload.minutos_minimos_anticipacion_reserva = newMinutos
    }

    const newDias  = diasMax !== '' ? Number(diasMax) : null
    const origDias = servicio.limite_dias_reserva !== undefined ? servicio.limite_dias_reserva : null
    if (newDias !== origDias) payload.limite_dias_reserva = newDias

    if (cancelacionLimitada !== (servicio.cancelacion_turno_limitada ?? false)) {
      payload.cancelacion_turno_limitada = cancelacionLimitada
    }

    if (Object.keys(payload).length === 0) { onClose(); return }

    setSaving(true)
    try {
      const updated = await sucursalService.updateServicioBase(sucursalId, servicio.id, payload)
      setBackSuccess({ message: 'Cambios guardados exitosamente.', onAccept: () => onUpdated(updated) })
    } catch (err) {
      setBackError(err)
    } finally {
      setSaving(false)
    }
  }

  /** Elimina el servicio base tras confirmación. */
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await sucursalService.deleteServicioBase(sucursalId, servicio.id)
      onDeleted(servicio.id)
    } catch (err) {
      setBackError(err)
    } finally {
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  // Lista de versiones a mostrar en el modal (edit mode)
  const versionesExistentes = servicio?.servicios ?? []

  return (
    <>
      {/* Overlay */}
      <div
        className="sm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={isCreate ? 'Crear servicio' : 'Editar servicio'}
      >
        <div className={`sm-card ${(versionModalOpen || bloqueoModalOpen || backSuccess || backError) ? 'sm-card--dimmed' : ''}`} onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="sm-header">
            <span className="csm-title">Servicio</span>
            <button className="csm-btn-help" onClick={() => setHelpOpen((v) => !v)} type="button" aria-label="Ayuda">
              <span className="csm-btn-help__icon">?</span>
              Ayuda
            </button>
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar modal" type="button">✕</button>
          </div>

          {/* ── Panel de ayuda ── */}
          {helpOpen && (
            <div className="csm-help">

              <p className="csm-help__section-title">Datos principales</p>
              <p className="csm-help__text">Son los datos principales que identifican al servicio: nombre, profesional, reglas de reserva y cancelación.</p>
              <p className="csm-help__text"><strong>Nombre</strong>: Identificador del servicio, máximo 100 caracteres. Si se desea que un mismo servicio tenga distintos profesionales, debe crearse otro servicio con el mismo nombre y distinto profesional.</p>
              <p className="csm-help__text"><strong>Profesional asignado</strong>: Miembro responsable del servicio. Si el servicio no requiere profesional, puede dejarse sin uno.</p>
              <p className="csm-help__text"><strong>Cancelación limitada</strong>: Cuando está activa, solo el profesional asignado o sus superiores pueden cancelar un turno. Requiere tener un profesional asignado.</p>
              <p className="csm-help__text"><strong>Tiempo mínimo de reserva</strong>: Anticipación mínima que necesita el cliente para reservar. Ej: "2 horas" impide reservar con menos de 2 horas de antelación. Dejalo deshabilitado para no tener límite.</p>
              <p className="csm-help__text"><strong>Límite de días</strong>: Cuántos días a futuro puede el cliente ver y reservar turnos. Dejá vacío para no tener límite.</p>
              <p className="csm-help__text"><strong>Aclaración</strong>: Texto libre visible para el cliente con información adicional (máx. 255 caracteres).</p>

              <p className="csm-help__section-title">Versiones del servicio</p>
              <p className="csm-help__text">Cada versión tiene un período de vigencia, precio, duración y horarios. Cuando necesités cambiar la fecha de vigencia final, el precio u horarios, podés crear una nueva versión que comience a partir de otra fecha posterior, sin perder la versión actual. Máximo 2 versiones por servicio.</p>
              <p className="csm-help__text"><strong>Duración</strong>: Duración de cada turno en minutos. Debe ser mayor a 0 y múltiplo de 5 (ej: 15, 30, 45, 60). Solo se puede definir al crear la versión.</p>
              <p className="csm-help__text"><strong>Precio</strong>: Precio del servicio en pesos. Puede ser 0 si es gratuito. Máximo 10 dígitos con 2 decimales.</p>
              <p className="csm-help__text"><strong>Vigente desde</strong>: Fecha a partir de la cual esta versión está activa. Debe ser al menos mañana. Solo se puede definir al crear la versión.</p>
              <p className="csm-help__text"><strong>Vigente hasta</strong>: Opcional. Si se deja vacío, la versión no tiene fecha de vencimiento. Debe ser mayor o igual a "Vigente desde".</p>

              <p className="csm-help__section-title">Configuración de horarios</p>
              <p className="csm-help__text">Usá el botón "Configurar horarios" para agregar los horarios disponibles.</p>
              <p className="csm-help__text"><strong>Franja horaria (inicio → fin)</strong>: El rango de horas en que se ofrecen turnos. Tanto el inicio como el fin son turnos válidos. Ambos deben ser múltiplo de 5 minutos (ej: 8:00, 9:15, 10:30).</p>
              <p className="csm-help__text"><strong>Salto (intervalo)</strong>: Cada cuántos minutos se genera un turno dentro de la franja. Debe ser múltiplo de 5 y la duración total de la franja debe ser divisible por él. Ej: franja 8:00→9:00 con salto 30 genera los turnos 8:00, 8:30 y 9:00. Si además querés turnos cada 15 minutos desde las 9:15 hasta las 10:00, agregá una segunda franja 9:15→10:00 con salto 15 — que suma los turnos (9:15, 9:30, 9:45 y 10:00).</p>
              <p className="csm-help__text"><strong>Turnos simultáneos</strong>: Cuántos clientes distintos pueden reservar el mismo horario al mismo tiempo. Útil para clases grupales o servicios con múltiples puestos. Mínimo 1 si se quiere habilitar la franja horaria. Si se quiere deshabilitarla sin borrarla, se puede poner 0.</p>

              <p className="csm-help__section-title">Bloqueos de fechas</p>
              <p className="csm-help__text">Los bloqueos permiten deshabilitar el servicio durante un rango de fechas específico, sin necesidad de eliminar ni modificar sus versiones u horarios. Son útiles para feriados, vacaciones, mantenimientos u otras ausencias programadas.</p>
              <p className="csm-help__text"><strong>Fecha inicio / Fecha fin</strong>: Definen el período bloqueado, ambas inclusive. Durante ese rango los clientes no podrán reservar turnos para este servicio. Si el bloqueo es de un solo día, ambas fechas deben coincidir.</p>
              <p className="csm-help__text"><strong>Motivo</strong>: Opcional. Texto para identificar el bloqueo (máx. 255 caracteres). Es visible para los clientes.</p>

            </div>
          )}

          {/* ── Cuerpo ── */}
          <div className="sm-body">

            {/* SECCIÓN: Datos principales */}
            <div className="csm-section-label">Datos principales</div>

            {/* Nombre */}
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
              {formErrors.nombre && <span className="sm-field__error">{formErrors.nombre}</span>}
            </div>

            <div className="sm-form-grid">

              {/* Tiempo mínimo */}
              <div className="sm-field">
                <label className="sm-field__label">Tiempo mínimo para reserva de turnos</label>
                <div className="sm-dual-input">
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

              {/* Límite de días */}
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
                    ...(!isCreate && servicio?.profesional_id && !miembrosList.some((m) => m.id === servicio.profesional_id)
                      ? [{ value: String(servicio.profesional_id), label: `${servicio.profesional_apellido}, ${servicio.profesional_nombre}` }]
                      : []),
                  ]}
                  value={String(efectivoProfesionalId)}
                  onChange={isCreate ? (val) => setProfesionalId(val) : undefined}
                  width="100%"
                  height={39}
                  disabled={!isCreate}
                />
              </div>

              {/* Cancelación limitada */}
              <div className="sm-field">
                <label className="sm-field__label">Cancelación de turno limitada</label>
                <div className="sm-toggle-row">
                  <label
                    className="sm-toggle"
                    style={!efectivoProfesionalId ? { cursor: 'not-allowed' } : {}}
                  >
                    <input
                      type="checkbox"
                      className="sm-toggle__input"
                      checked={cancelacionLimitada}
                      onChange={(e) => { if (efectivoProfesionalId) setCancelacionLimitada(e.target.checked) }}
                    />
                    <span className="sm-toggle__track" style={!efectivoProfesionalId ? { cursor: 'not-allowed' } : {}} />
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
              {formErrors.aclaracion && <span className="sm-field__error">{formErrors.aclaracion}</span>}
            </div>

            {/* ── SECCIÓN: Versiones del servicio ── */}
            <div className="csm-section-label csm-section-label--versiones">Versiones del servicio</div>

            <div className="sm-versiones">
              {isCreate ? (
                // Create mode: borradores de versión
                <>
                  {pendingVersiones.length === 0 ? (
                    // Estado vacío: botón y descripción en la misma fila
                    <div className="sm-versiones__add-row">
                      <button
                        className="sm-btn-add-version"
                        type="button"
                        onClick={() => openVersionModal(null)}
                      >
                        + Agregar versión
                      </button>
                      <span className="sm-versiones__empty">
                        Debés agregar una versión para crear el servicio.
                      </span>
                    </div>
                  ) : (
                    <>
                      {pendingVersiones.map((v, i) => (
                        <VersionCard
                          key={i}
                          v={v}
                          onEdit={() => openVersionModal(i)}
                        />
                      ))}
                      {pendingVersiones.length < 1 && (
                        <button
                          className="sm-btn-add-version"
                          type="button"
                          onClick={() => openVersionModal(null)}
                        >
                          + Agregar versión
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                // Edit mode: versiones reales del servicio
                <>
                  {versionesExistentes.map((v) => (
                    <VersionCard
                      key={v.id}
                      v={v}
                      onEdit={() => openVersionModal(v)}
                    />
                  ))}
                  {versionesExistentes.length < 2 && (
                    <button
                      className="sm-btn-add-version"
                      type="button"
                      onClick={() => openVersionModal(null)}
                      disabled={saving}
                    >
                      + Nueva versión
                    </button>
                  )}
                </>
              )}
            </div>

          </div>

          {/* ── Footer ── */}
          {isCreate ? (
            /* Create: 2 botones centrados */
            <div className="sm-footer sm-footer--create">
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
                onClick={handleCreate}
                disabled={saving || pendingVersiones.length === 0}
                type="button"
              >
                {saving ? 'Creando...' : 'Crear servicio'}
              </button>
            </div>
          ) : (
            /* Edit: 4 botones distribuidos */
            <div className="sm-footer sm-footer--edit">
              <button
                className="btn sm-footer__btn sm-footer__btn--cancel"
                onClick={onClose}
                disabled={saving || deleting}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="btn sm-footer__btn sm-footer__btn--delete"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting || confirmDelete}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Eliminar servicio
              </button>
              <button
                className="btn sm-footer__btn sm-footer__btn--bloqueos"
                onClick={() => setBloqueoModalOpen(true)}
                disabled={saving || deleting}
                type="button"
              >
                Bloqueos de fechas
                {bloqueos.length > 0 && (
                  <span className="sm-footer__badge">{bloqueos.length}</span>
                )}
              </button>
              <button
                className="btn sm-footer__btn sm-footer__btn--confirm"
                onClick={handleUpdate}
                disabled={saving || deleting}
                type="button"
              >
                {saving ? 'Guardando...' : 'Confirmar cambios'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* VersionModal */}
      {versionModalOpen && (
        <VersionModal
          version={
            // En create mode siempre null (los borradores van en initialData)
            isCreate
              ? null
              : (editingVersion && typeof editingVersion === 'object' ? editingVersion : null)
          }
          initialData={
            // En create mode: pre-llena cuando se edita un borrador pendiente
            isCreate && typeof editingVersion === 'number'
              ? pendingVersiones[editingVersion]
              // En edit mode + nueva versión: copia la versión activa (sin fechas de vigencia)
              : (!isCreate && editingVersion === null && versionesExistentes.length > 0)
                ? (() => {
                    const v = getVersionActiva(versionesExistentes)
                    if (!v) return undefined
                    return {
                      duracion:         v.duracion,
                      precio:           v.precio,
                      disponibilidades: v.disponibilidades ?? [],
                      vigente_desde:    '',
                      vigente_hasta:    '',
                    }
                  })()
                : undefined
          }
          onClose={() => setVersionModalOpen(false)}
          onSave={isCreate ? handlePendingVersionSave : handleSaveVersion}
          onDelete={
            // Solo habilitar eliminar si estamos editando una versión existente y hay más de una
            !isCreate && editingVersion && typeof editingVersion === 'object' && versionesExistentes.length > 1
              ? async () => {
                  try {
                    await sucursalService.deleteVersion(sucursalId, servicio.id, editingVersion.id)
                    const updated = {
                      ...servicio,
                      servicios: versionesExistentes.filter((v) => v.id !== editingVersion.id),
                    }
                    setVersionModalOpen(false)
                    onVersionUpdated(updated)
                  } catch (err) {
                    setBackError(err)
                  }
                }
              : undefined
          }
        />
      )}

      {/* Modal de bloqueos (excepciones de fechas) — solo en modo edición */}
      {bloqueoModalOpen && !isCreate && (
        <BloqueoModal
          sucursalId={sucursalId}
          servicioBaseId={servicio.id}
          bloqueos={bloqueos}
          onClose={() => setBloqueoModalOpen(false)}
          onChanged={(updated) => {
            setBloqueos(updated)
            onVersionUpdated?.({ ...servicio, excepciones_fechas: updated })
          }}
        />
      )}

      {/* Modal de éxito — al aceptar ejecuta el callback (cierra ServicioModal) */}
      {backSuccess && (
        <ErrorModal
          success={backSuccess.message}
          onClose={() => {
            const cb = backSuccess.onAccept
            setBackSuccess(null)
            cb?.()
          }}
        />
      )}

      {/* Modal de errores del back */}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}

      {/* Modal de confirmación para eliminar servicio */}
      {confirmDelete && (
        <ConfirmModal
          icon="🗑️"
          message="¿Deseás eliminar este servicio? Esta acción no se puede deshacer."
          confirmText="Sí, eliminar"
          confirmVariant="btn-danger"
          loading={deleting}
          loadingText="Eliminando..."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
