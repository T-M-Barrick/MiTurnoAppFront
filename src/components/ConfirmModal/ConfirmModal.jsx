import { useEffect } from 'react'
import './ConfirmModal.css'

/**
 * Modal de confirmación genérico reutilizable.
 *
 * Props:
 *   icon           — emoji de ícono (default: '❓')
 *   message        — texto de la pregunta
 *   confirmText    — texto del botón confirmar  (default: 'Aceptar')
 *   confirmVariant — clase CSS del botón confirmar (default: 'btn-danger')
 *   cancelText     — texto del botón cancelar   (default: 'Cancelar')
 *   loading        — bool, deshabilita botones y muestra texto alterno
 *   loadingText    — texto mientras loading      (default: 'Procesando...')
 *   onConfirm      — función al confirmar
 *   onCancel       — función al cancelar
 *   children       — contenido extra entre mensaje y botones (ej: selector de calificación)
 */
export default function ConfirmModal({
  icon           = '❓',
  message,
  confirmText    = 'Aceptar',
  confirmVariant = 'btn-danger',
  cancelText     = 'Cancelar',
  loading        = false,
  loadingText    = 'Procesando...',
  onConfirm,
  onCancel,
  children,
}) {
  // Cierra con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !loading) onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loading, onCancel])

  return (
    <div
      className="cmodal-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div className="cmodal" onClick={(e) => e.stopPropagation()}>

        {/* Botón cerrar */}
        <button className="cmodal__close" onClick={onCancel} disabled={loading} aria-label="Cerrar" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Ícono */}
        <div className="cmodal__icon" aria-hidden="true">{icon}</div>

        {/* Mensaje */}
        <p className="cmodal__message">{message}</p>

        {/* Contenido extra opcional (ej: calificación) */}
        {children && <div className="cmodal__extra">{children}</div>}

        {/* Acciones */}
        <div className="cmodal__actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className={`btn ${confirmVariant}`}
            onClick={onConfirm}
            disabled={loading}
            type="button"
          >
            {loading ? loadingText : confirmText}
          </button>
        </div>

      </div>
    </div>
  )
}
