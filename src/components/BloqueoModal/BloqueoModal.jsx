import { useState, useRef } from 'react'
import { sucursalService } from '../../services/sucursalService'
import { scrollToFirstError } from '../../utils/validation'
import { useFooterLayout } from '../../utils/useFooterLayout'
import ErrorModal from '../ErrorModal/ErrorModal'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import DateInput from '../DateInput/DateInput'
import './BloqueoModal.css'

/** Formatea "YYYY-MM-DD" → "DD/MM/YYYY" */
function fmt(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/** Valida los campos del formulario. */
function validateBloqueo({ fechaInicio, fechaFin }) {
  const errors = {}
  if (!fechaInicio) errors.fechaInicio = 'La fecha de inicio es requerida'
  if (!fechaFin)    errors.fechaFin    = 'La fecha de fin es requerida'
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    errors.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio'
  }
  return errors
}

/**
 * Modal de gestión de bloqueos (excepciones de fechas) de un servicio.
 *
 * Props:
 *   sucursalId     — id de la sucursal
 *   servicioBaseId — id del servicio base
 *   bloqueos       — array inicial de ExcepcionFechaServicioOut
 *   onClose        — callback al cerrar
 *   onChanged      — callback(bloqueos) cuando la lista cambia
 */
export default function BloqueoModal({ sucursalId, servicioBaseId, bloqueos: initialBloqueos, onClose, onChanged }) {
  const [bloqueos,       setBloqueos]       = useState(initialBloqueos ?? [])
  const [formOpen,       setFormOpen]       = useState(false)
  const [editingBloqueo, setEditingBloqueo] = useState(null) // null = creando nuevo

  // Campos del formulario
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin,    setFechaFin]    = useState('')
  const [motivo,      setMotivo]      = useState('')
  const [formErrors,  setFormErrors]  = useState({})

  const [saving,       setSaving]       = useState(false)
  const [deletingId,   setDeletingId]   = useState(null)
  const [confirmId,    setConfirmId]    = useState(null)
  const [backError,    setBackError]    = useState(null)
  const [backSuccess,  setBackSuccess]  = useState(null)

  const footerListRef = useRef(null)
  const footerFormRef = useRef(null)
  const listMode      = useFooterLayout(footerListRef)
  const formMode      = useFooterLayout(footerFormRef)

  /** Abre el formulario para crear un nuevo bloqueo. */
  const openCreate = () => {
    setEditingBloqueo(null)
    setFechaInicio('')
    setFechaFin('')
    setMotivo('')
    setFormErrors({})
    setFormOpen(true)
  }

  /** Abre el formulario pre-llenado para editar un bloqueo existente. */
  const openEdit = (b) => {
    setEditingBloqueo(b)
    setFechaInicio(b.fecha_inicio)
    setFechaFin(b.fecha_fin)
    setMotivo(b.motivo ?? '')
    setFormErrors({})
    setFormOpen(true)
  }

  const closeForm = () => setFormOpen(false)

  /** Guarda: crea o actualiza según si hay bloqueo en edición. */
  const handleSave = async () => {
    const errors = validateBloqueo({ fechaInicio, fechaFin })
    if (Object.keys(errors).length > 0) { setFormErrors(errors); scrollToFirstError(); return }
    setFormErrors({})

    setSaving(true)
    try {
      let updated
      if (editingBloqueo) {
        const payload = {}
        if (fechaInicio !== editingBloqueo.fecha_inicio) payload.fecha_inicio = fechaInicio
        if (fechaFin    !== editingBloqueo.fecha_fin)    payload.fecha_fin    = fechaFin
        const newMotivo = motivo.trim() || null
        if (newMotivo !== (editingBloqueo.motivo ?? null)) payload.motivo = newMotivo

        if (Object.keys(payload).length === 0) { closeForm(); return }

        const result = await sucursalService.updateExcepcion(sucursalId, servicioBaseId, editingBloqueo.id, payload)
        updated = bloqueos.map((b) => b.id === editingBloqueo.id ? result : b)
      } else {
        const payload = {
          fecha_inicio: fechaInicio,
          fecha_fin:    fechaFin,
          motivo:       motivo.trim() || null,
        }
        const created = await sucursalService.createExcepcion(sucursalId, servicioBaseId, payload)
        updated = [...bloqueos, created]
      }

      setBloqueos(updated)
      onChanged(updated)
      setBackSuccess(editingBloqueo ? 'Bloqueo modificado correctamente.' : 'Bloqueo creado correctamente.')
    } catch (err) {
      setBackError(err)
    } finally {
      setSaving(false)
    }
  }

  /** Elimina un bloqueo tras confirmación. */
  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await sucursalService.deleteExcepcion(sucursalId, servicioBaseId, id)
      const updated = bloqueos.filter((b) => b.id !== id)
      setBloqueos(updated)
      onChanged(updated)
      closeForm()
    } catch (err) {
      setBackError(err)
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <>
      {/* ── Modal lista de bloqueos ── */}
      <div className="blq-overlay" role="dialog" aria-modal="true" aria-label="Bloqueos de fechas">
        <div className={`blq-card${formOpen ? ' blq-card--dimmed' : ''}`} onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="blq-header">
            <span className="blq-header__title">Bloqueos de fechas</span>
            <button className="btn-icon" type="button" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>

          {/* Cuerpo */}
          <div className="blq-body">
            {bloqueos.length === 0 ? (
              <div className="blq-empty">
                <span className="blq-empty__icon">📅</span>
                <span className="blq-empty__text">No hay bloqueos registrados para este servicio.</span>
              </div>
            ) : (
              <ul className="blq-list">
                {bloqueos.map((b) => (
                  <li
                    key={b.id}
                    className="blq-item"
                    onClick={() => openEdit(b)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openEdit(b)}
                  >
                    <div className="blq-item__dates">
                      <span className="blq-item__range">
                        Desde {fmt(b.fecha_inicio)} hasta {fmt(b.fecha_fin)}
                      </span>
                      {b.motivo && (
                        <span className="blq-item__motivo">{b.motivo}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div ref={footerListRef} className={`blq-footer blq-footer--${listMode}`}>
            <button className="btn blq-footer__btn blq-footer__btn--cancel" type="button" onClick={onClose}>
              Cerrar
            </button>
            <button className="btn blq-footer__btn blq-footer__btn--create" type="button" onClick={openCreate}>
              + Nuevo bloqueo
            </button>
          </div>

        </div>
      </div>

      {/* ── Modal formulario (crear / editar) — encima del de lista ── */}
      {formOpen && (
        <div className="blq-overlay blq-overlay--form" role="dialog" aria-modal="true" aria-label={editingBloqueo ? 'Bloqueo' : 'Nuevo bloqueo'}>
          <div className="blq-card blq-card--form" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="blq-header">
              <span className="blq-header__title">
                {editingBloqueo ? 'Bloqueo' : 'Nuevo bloqueo'}
              </span>
              <button className="btn-icon" type="button" onClick={closeForm} aria-label="Cerrar">✕</button>
            </div>

            {/* Cuerpo */}
            <div className="blq-body blq-body--form">

              <div className="blq-form-row">
                <div className="blq-field">
                  <label className="blq-field__label">Fecha inicio <span className="csm-required">*</span></label>
                  <DateInput
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="blq-field__input"
                    wrapperClassName="date-wrap--indigo"
                  />
                  {formErrors.fechaInicio && <span className="blq-field__error">{formErrors.fechaInicio}</span>}
                </div>

                <div className="blq-field">
                  <label className="blq-field__label">Fecha fin <span className="csm-required">*</span></label>
                  <DateInput
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    min={fechaInicio || undefined}
                    className="blq-field__input"
                    wrapperClassName="date-wrap--indigo"
                  />
                  {formErrors.fechaFin && <span className="blq-field__error">{formErrors.fechaFin}</span>}
                </div>
              </div>

              <div className="blq-field">
                <label className="blq-field__label">Motivo</label>
                <textarea
                  className="blq-field__textarea"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: feriado, mantenimiento..."
                  maxLength={255}
                  rows={3}
                />
                <span className={`blq-field__char-count${motivo.length > 230 ? ' blq-field__char-count--warn' : ''}`}>
                  {motivo.length}/255
                </span>
              </div>

            </div>

            {/* Footer */}
            <div ref={footerFormRef} className={`blq-footer blq-footer--${formMode}`}>
              <button className="btn blq-footer__btn blq-footer__btn--cancel" type="button" onClick={closeForm} disabled={saving}>
                Cancelar
              </button>
              {editingBloqueo && (
                <button className="btn blq-footer__btn blq-footer__btn--delete" type="button"
                  onClick={() => setConfirmId(editingBloqueo.id)} disabled={saving}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                  Eliminar bloqueo
                </button>
              )}
              <button className="btn blq-footer__btn blq-footer__btn--create" type="button" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      {confirmId !== null && (
        <ConfirmModal
          icon="🗑️"
          message="¿Deseás eliminar este bloqueo? Esta acción no se puede deshacer."
          confirmText="Sí, eliminar"
          confirmVariant="btn-indigo"
          loading={deletingId === confirmId}
          loadingText="Eliminando..."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Éxito al guardar */}
      {backSuccess && (
        <ErrorModal
          success={backSuccess}
          onClose={() => { setBackSuccess(null); closeForm() }}
        />
      )}

      {/* Errores del back */}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </>
  )
}
