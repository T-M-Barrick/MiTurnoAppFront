import { useState, useEffect } from 'react'
import { sucursalService } from '../../services/sucursalService'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import ReservarTurnoModal from '../ReservarTurnoModal/ReservarTurnoModal'
import ClienteFormModal from '../ClienteFormModal/ClienteFormModal'
import './ClienteDetailModal.css'

/**
 * Modal de detalle de un cliente de sucursal (ClienteOut).
 *
 * Props:
 *   cliente    — objeto ClienteOut | null
 *   sucursalId — id de la sucursal
 *   onClose    — cerrar el modal
 *   onUpdated  — callback(clienteActualizado) tras desactivar/reactivar
 *   onError    — callback(errorObj) para mostrar ErrorModal
 */
export default function ClienteDetailModal({ cliente, sucursalId, onClose, onUpdated, onError }) {

  const [confirmAction,  setConfirmAction]  = useState(null) // 'desactivar' | 'reactivar'
  const [reservarOpen,   setReservarOpen]   = useState(false)
  const [modificarOpen,  setModificarOpen]  = useState(false)
  const [loading,        setLoading]        = useState(false)

  // Resetea estado al abrir un cliente distinto
  useEffect(() => {
    if (!cliente) return
    setConfirmAction(null)
  }, [cliente])

  // Cierra con Escape (solo si no hay confirm abierto)
  useEffect(() => {
    if (!cliente) return
    const handler = (e) => {
      if (e.key === 'Escape' && !confirmAction) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cliente, onClose, confirmAction])

  if (!cliente) return null

  // Formatea DNI con puntos: "12345678" → "12.345.678"
  const formatDni = (dni) => {
    if (!dni) return null
    return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  // Formatea fecha de alta
  const formatFechaAlta = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      if (confirmAction === 'desactivar') {
        await sucursalService.desactivarCliente(sucursalId, cliente.id)
        onUpdated?.({ ...cliente, activo: false })
      } else if (confirmAction === 'reactivar') {
        await sucursalService.reactivarCliente(sucursalId, cliente.id)
        onUpdated?.({ ...cliente, activo: true })
      }
    } catch (err) {
      onError?.(err)
    } finally {
      setConfirmAction(null)
      setLoading(false)
    }
  }

  const clienteNombre = `${cliente.apellido}, ${cliente.nombre}`

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal" onClick={(e) => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA ═══ */}
        <div className="tdmodal__header">
          <h3>Detalle del cliente</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="tdmodal__body">

          {/* ── Nombre + badge activo/inactivo ── */}
          <div className="tdsumodal__top-row">
            <div className="tdsumodal__cliente-row">
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">👤</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Cliente:</span>
                  <span className="tdmodal__row-val">{clienteNombre}</span>
                </div>
              </div>
            </div>
            <div className="tdsumodal__badge-wrap cdmodal__badge-wrap">
              {cliente.bloqueado && (
                <span className="tdmodal__badge cdmodal__badge--bloqueado">Bloqueado</span>
              )}
              <span className={`tdmodal__badge ${cliente.activo ? 'cdmodal__badge--activo' : 'cdmodal__badge--inactivo'}`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* ── Filas de información ── */}
          <div className="tdmodal__info">

            {/* 🪪 DNI */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon tdsumodal__dni-icon">🪪</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">DNI:</span>
                <span className="tdmodal__row-val">{formatDni(cliente.dni)}</span>
              </div>
            </div>

            {/* 📧 Email */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">📧</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Email:</span>
                <span className="tdmodal__row-val">{cliente.email}</span>
              </div>
            </div>

            {/* ☎️ Teléfono (y teléfono 2 al lado si existe) */}
            {cliente.telefono && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon cdmodal__tel-icon">☎️</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Teléfono:</span>
                  <span className="tdmodal__row-val">
                    {cliente.telefono}
                    {cliente.telefono2 && <> · {cliente.telefono2}</>}
                  </span>
                </div>
              </div>
            )}

            {/* 📝 Observación */}
            {cliente.observacion && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">📝</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Observación:</span>
                  <span className="tdmodal__row-val cdmodal__observacion">{cliente.observacion}</span>
                </div>
              </div>
            )}

            {/* 📅 Fecha de alta */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">📅</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Alta:</span>
                <span className="tdmodal__row-val">{formatFechaAlta(cliente.fecha_hora_alta)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ ACCIONES ═══ */}
        <div className="tdmodal__actions cdmodal__actions">

          {/* Cerrar */}
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>

          {/* Desactivar / Reactivar */}
          {cliente.activo ? (
            <button
              className="btn btn-orange"
              onClick={() => setConfirmAction('desactivar')}
              disabled={loading}
            >
              Desactivar
            </button>
          ) : (
            <button
              className="btn btn-orange"
              onClick={() => setConfirmAction('reactivar')}
              disabled={loading}
            >
              Reactivar
            </button>
          )}

          <button className="btn btn-indigo" onClick={() => setModificarOpen(true)} disabled={loading}>
            Modificar
          </button>

          {/* Reservar turno */}
          <button
            className="btn btn-green"
            onClick={() => setReservarOpen(true)}
            disabled={loading}
          >
            Reservar turno
          </button>

        </div>
      </div>

      {/* ═══ CONFIRM: desactivar ═══ */}
      {confirmAction === 'desactivar' && (
        <ConfirmModal
          icon="⚠️"
          message="¿Deseás desactivar este cliente?"
          confirmText="Desactivar"
          confirmVariant="btn-orange"
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ═══ CONFIRM: reactivar ═══ */}
      {confirmAction === 'reactivar' && (
        <ConfirmModal
          icon="✅"
          message="¿Deseás reactivar este cliente?"
          confirmText="Reactivar"
          confirmVariant="btn-orange"
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ═══ MODAL: reservar turno ═══ */}
      {reservarOpen && (
        <ReservarTurnoModal
          sucursalId={sucursalId}
          cliente={cliente}
          onClose={() => setReservarOpen(false)}
          onError={onError}
        />
      )}

      {/* ═══ MODAL: modificar cliente ═══ */}
      {modificarOpen && (
        <ClienteFormModal
          sucursalId={sucursalId}
          cliente={cliente}
          onClose={() => setModificarOpen(false)}
          onUpdated={(actualizado) => {
            setModificarOpen(false)
            onUpdated?.(actualizado)
          }}
          onError={onError}
        />
      )}
    </div>
  )
}
