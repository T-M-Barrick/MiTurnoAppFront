import { useState, useEffect, useRef } from 'react'
import { scrollToFirstError } from '../../utils/validation'
import { useFooterLayout } from '../../utils/useFooterLayout'
import HorariosModal from '../HorariosModal/HorariosModal'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import DateInput from '../DateInput/DateInput'
import './VersionModal.css'

/** Devuelve mañana en formato YYYY-MM-DD usando hora local. */
function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Descompone minutos totales en { h, m } como strings. */
function parseDuracion(totalMin) {
  if (totalMin == null || totalMin === '') return { h: '', m: '' }
  const total = Number(totalMin)
  if (isNaN(total) || total <= 0) return { h: '', m: '' }
  return {
    h: String(Math.floor(total / 60)),
    m: String(total % 60).padStart(2, '0'),
  }
}

/**
 * Valida que el precio cumpla: >= 0, máximo 10 dígitos en total,
 * máximo 2 decimales (replica las reglas de condecimal del back).
 */
function validarPrecio(rawPrecio) {
  if (rawPrecio === '' || rawPrecio == null) return 'El precio es requerido y debe ser mayor o igual a 0'
  const num = Number(rawPrecio)
  if (isNaN(num) || num < 0) return 'El precio es requerido y debe ser mayor o igual a 0'

  // Validar max_digits=10 y decimal_places=2
  const str = String(rawPrecio).replace(',', '.')
  const [intPart, decPart] = str.split('.')
  const totalDigits = (intPart?.replace('-', '').length ?? 0) + (decPart?.length ?? 0)
  if (totalDigits > 10) return 'El precio no puede superar los 10 dígitos en total'
  if (decPart && decPart.length > 2) return 'El precio no puede tener más de 2 decimales'

  return null
}

/** Valida los campos del formulario de versión. */
function validateForm(fields, isCreate) {
  const errors = {}

  // Precio
  const precioErr = validarPrecio(fields.precio)
  if (precioErr) errors.precio = precioErr

  if (isCreate) {
    // Duración: horas + minutos
    const h = fields.duracion_h !== '' ? parseInt(fields.duracion_h, 10) : NaN
    const m = fields.duracion_m !== '' ? parseInt(fields.duracion_m, 10) : NaN

    if (isNaN(h) || isNaN(m)) {
      errors.duracion = 'Completá las horas y minutos de duración'
    } else if (m < 0 || m > 55) {
      errors.duracion = 'Los minutos deben estar entre 0 y 55'
    } else if (m % 5 !== 0) {
      errors.duracion = 'Los minutos deben ser múltiplo de 5'
    } else if (h * 60 + m <= 0) {
      errors.duracion = 'La duración debe ser mayor a 0'
    }

    // Vigente desde: requerido, >= mañana
    if (!fields.vigente_desde) {
      errors.vigente_desde = 'La fecha de inicio es requerida'
    } else if (fields.vigente_desde < getTomorrow()) {
      errors.vigente_desde = 'La fecha de inicio debe ser al menos mañana'
    }
  }

  // Vigente hasta: si se ingresa, debe ser ESTRICTAMENTE > vigente_desde
  const vd = isCreate ? fields.vigente_desde : fields.vigente_desde_base
  if (fields.vigente_hasta) {
    if (!vd) {
      errors.vigente_hasta = 'No se puede establecer fecha de fin sin fecha de inicio'
    } else if (fields.vigente_hasta <= vd) {
      errors.vigente_hasta = 'La fecha de fin debe ser posterior a la de inicio'
    }
  }

  return errors
}

/**
 * Modal para crear o editar una versión de servicio.
 *
 * Props:
 *   version            — null para crear, objeto versión para editar
 *   initialData        — opcional: datos previos para pre-llenar en modo create (edición de borrador)
 *   onClose            — callback al cerrar
 *   onSave(data)       — callback con los datos recolectados (el padre llama al API)
 */
export default function VersionModal({ version, initialData, onClose, onSave, onDelete }) {
  const isCreate = !version

  // En create mode con borrador previo, pre-llenamos desde initialData
  const pre = isCreate ? (initialData ?? {}) : {}

  // Duración descompuesta en horas y minutos
  const initDuracion = isCreate
    ? parseDuracion(pre.duracion)
    : parseDuracion(version.duracion)

  const [duracion_h,    setDuracionH]    = useState(initDuracion.h)
  const [duracion_m,    setDuracionM]    = useState(initDuracion.m)
  const [precio,        setPrecio]       = useState(
    isCreate
      ? (pre.precio != null ? String(pre.precio) : '')
      : (version.precio != null ? String(version.precio) : '')
  )
  const [vigente_desde, setVigenteDesde] = useState(
    isCreate ? (pre.vigente_desde ?? getTomorrow()) : (version.vigente_desde ?? getTomorrow())
  )
  const [vigente_hasta, setVigenteHasta] = useState(
    isCreate ? (pre.vigente_hasta ?? '') : (version.vigente_hasta ?? '')
  )
  const [disponibilidades, setDisponibilidades] = useState(
    isCreate ? (pre.disponibilidades ?? []) : (version.disponibilidades ?? [])
  )

  // UI
  const [formErrors,        setFormErrors]        = useState({})
  const [horariosOpen,      setHorariosOpen]      = useState(false)
  const [confirmDelete,     setConfirmDelete]     = useState(false)
  const [deletingVersion,   setDeletingVersion]   = useState(false)

  const firstInputRef = useRef(null)
  const footerRef     = useRef(null)
  const footerMode    = useFooterLayout(footerRef)

  // Cierra con Escape (solo si HorariosModal no está abierto)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !horariosOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, horariosOpen])

  // Foco inicial
  useEffect(() => { firstInputRef.current?.focus() }, [])

  /** Valida y llama a onSave con los datos recolectados. */
  const handleConfirm = () => {
    const fields = {
      precio,
      duracion_h: isCreate ? duracion_h : '0',
      duracion_m: isCreate ? duracion_m : '0',
      vigente_desde:      isCreate ? vigente_desde : '',
      vigente_desde_base: isCreate ? '' : (version.vigente_desde ?? ''),
      vigente_hasta,
    }
    const errors = validateForm(fields, isCreate)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); scrollToFirstError(); return }
    setFormErrors({})

    const h = parseInt(duracion_h, 10) || 0
    const m = parseInt(duracion_m, 10) || 0

    onSave({
      ...(isCreate && { duracion: h * 60 + m, vigente_desde }),
      precio:        Number(precio),
      vigente_hasta: vigente_hasta || null,
      disponibilidades,
    })
  }

  /** Ejecuta el borrado tras confirmación. */
  const handleDeleteConfirm = async () => {
    setDeletingVersion(true)
    try {
      await onDelete()
    } finally {
      setDeletingVersion(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="vm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={isCreate ? 'Nueva versión' : 'Editar versión'}
      >
        <div className={`vm-card ${horariosOpen ? 'vm-card--dimmed' : ''}`} onClick={(e) => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="vm-header">
            <h2 className="vm-header__title">{isCreate ? 'Nueva versión' : 'Versión del servicio'}</h2>
            <button className="btn-icon" onClick={onClose} type="button" aria-label="Cerrar">✕</button>
          </div>

          {/* ── Cuerpo ── */}
          <div className="vm-body">
            <div className="sm-form-grid">

              {/* Duración + Precio — misma fila; Precio baja cuando no caben a 100px de ancho */}
              <div className="vm-dur-price-row sm-field--full">

                {/* Duración — editable en create, solo lectura en edit */}
                <div className="sm-field vm-field-duracion">
                  <label className="sm-field__label">
                    Duración {isCreate && <span className="csm-required">*</span>}
                  </label>
                  <div className="vm-duration-input">
                    <div className="vm-duration-input__group">
                      <input
                        ref={isCreate ? firstInputRef : undefined}
                        type="text"
                        inputMode="numeric"
                        className="vm-duration__input vm-duration__input--h"
                        value={duracion_h}
                        placeholder="0"
                        disabled={!isCreate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          setDuracionH(val)
                        }}
                      />
                      <span className="vm-duration__unit">horas</span>
                    </div>
                    <div className="vm-duration-input__group">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="vm-duration__input vm-duration__input--m"
                        value={duracion_m}
                        placeholder="00"
                        disabled={!isCreate}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                          setDuracionM(val)
                        }}
                      />
                      <span className="vm-duration__unit">minutos</span>
                    </div>
                  </div>
                  {formErrors.duracion && <span className="sm-field__error">{formErrors.duracion}</span>}
                </div>

                {/* Precio */}
                <div className="sm-field vm-field-precio">
                  <label className="sm-field__label">
                    Precio ($) <span className="csm-required">*</span>
                  </label>
                  <input
                    ref={isCreate ? undefined : firstInputRef}
                    type="number"
                    className="sm-field__input"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    min={0}
                    step={0.01}
                    placeholder="ej: 5000"
                  />
                  {formErrors.precio && <span className="sm-field__error">{formErrors.precio}</span>}
                </div>

              </div>

              {/* Vigente desde y Vigente hasta — mismo ancho, se apilan al llegar al mínimo de fecha */}
              <div className="vm-dates-row sm-field--full">

                {/* Vigente desde — editable en create, solo lectura en edit */}
                <div className="sm-field">
                  <label className="sm-field__label">
                    Vigente desde {isCreate && <span className="csm-required">*</span>}
                  </label>
                  <DateInput
                    value={vigente_desde}
                    onChange={isCreate ? (e) => setVigenteDesde(e.target.value) : undefined}
                    disabled={!isCreate}
                    min={isCreate ? getTomorrow() : undefined}
                    className="sm-field__input"
                  />
                  {formErrors.vigente_desde && <span className="sm-field__error">{formErrors.vigente_desde}</span>}
                </div>

                {/* Vigente hasta */}
                <div className="sm-field">
                  <label className="sm-field__label">Vigente hasta</label>
                  <DateInput
                    value={vigente_hasta}
                    onChange={(e) => setVigenteHasta(e.target.value)}
                    className="sm-field__input"
                  />
                  {formErrors.vigente_hasta && <span className="sm-field__error">{formErrors.vigente_hasta}</span>}
                </div>

              </div>

            </div>

            {/* Botón configurar horarios */}
            <button
              className="sm-btn-horarios"
              onClick={() => setHorariosOpen(true)}
              type="button"
            >
              <svg className="sm-btn-horarios__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Configurar horarios
              {disponibilidades.length > 0 && (
                <span className="csm-horarios-count">
                  {disponibilidades.length} franja{disponibilidades.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>

          {/* ── Footer ── */}
          <div ref={footerRef} className={`vm-footer vm-footer--${footerMode}`}>
            <button className="btn vm-footer__btn vm-footer__btn--cancel" onClick={onClose} type="button">
              Cancelar
            </button>
            {onDelete && (
              <button
                className="btn vm-footer__btn vm-footer__btn--delete"
                onClick={() => setConfirmDelete(true)}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/>
                  <path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Eliminar versión
              </button>
            )}
            <button className="btn vm-footer__btn vm-footer__btn--confirm" onClick={handleConfirm} type="button">
              {isCreate ? 'Crear versión' : 'Guardar'}
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

      {/* Modal de confirmación para eliminar versión */}
      {confirmDelete && (
        <ConfirmModal
          icon="🗑️"
          message="¿Deseás eliminar esta versión? Esta acción no se puede deshacer."
          confirmText="Sí, eliminar"
          confirmVariant="btn-danger"
          loading={deletingVersion}
          loadingText="Eliminando..."
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
