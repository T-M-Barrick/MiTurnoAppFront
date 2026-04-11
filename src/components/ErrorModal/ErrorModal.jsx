import { useEffect } from 'react'
import { parseBackendError } from '../../utils/errorMessages'
import './ErrorModal.css'

/**
 * Modal genérico para mostrar errores del back y mensajes de éxito.
 *
 * Props:
 *   error   — objeto de error del back { code, metadata? } o null
 *   success — string con mensaje de éxito o null
 *   onClose — función que se llama al cerrar
 */
export default function ErrorModal({ error, success, onClose }) {
  // Cierra con Escape
  useEffect(() => {
    if (!error && !success) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [error, success, onClose])

  if (!error && !success) return null

  const isError = !!error
  const message = isError ? parseBackendError(error) : success

  return (
    <div
      className="emodal-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`emodal ${isError ? 'emodal--error' : 'emodal--success'}`}
      >
        {/* Botón cerrar */}
        <button className="emodal__close" onClick={onClose} aria-label="Cerrar" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Ícono */}
        <div className="emodal__icon">
          {isError ? '⚠️' : '✅'}
        </div>

        {/* Título */}
        <h3 className="emodal__title">
          {isError ? 'Ocurrió un error' : '¡Listo!'}
        </h3>

        {/* Mensaje */}
        <p className="emodal__message">{message}</p>

        {/* Botón Aceptar */}
        <button className={`btn ${isError ? 'btn-danger' : 'btn-primary'} emodal__btn`} onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  )
}
