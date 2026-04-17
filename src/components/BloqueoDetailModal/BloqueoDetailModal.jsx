import { useState, useEffect } from 'react'
import { sucursalService } from '../../services/sucursalService'
import { getRolLabel } from '../../utils/rolUtils'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import './BloqueoDetailModal.css'

const ROL_CLASS = {
  PROPIETARIO:      'bdmodal__rol-badge--propietario',
  GERENTE_EMPRESA:  'bdmodal__rol-badge--gerente-empresa',
  GERENTE_SUCURSAL: 'bdmodal__rol-badge--gerente-sucursal',
  EMPLEADO:         'bdmodal__rol-badge--empleado',
}

/**
 * Modal de detalle de un cliente bloqueado (BlockClienteOut).
 *
 * Props:
 *   bloqueo        — objeto BlockClienteOut | null
 *   sucursalId     — id de la sucursal
 *   numSucursales  — cantidad de sucursales de la empresa (para etiqueta de rol)
 *   onClose        — cerrar el modal
 *   onDesbloqueado — callback(clienteId) tras desbloquear
 *   onError        — callback(errorObj) para mostrar ErrorModal
 */
export default function BloqueoDetailModal({ bloqueo, sucursalId, numSucursales = 1, onClose, onDesbloqueado, onError }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading,     setLoading]     = useState(false)

  // Resetea estado al abrir un bloqueo distinto
  useEffect(() => {
    if (!bloqueo) return
    setConfirmOpen(false)
  }, [bloqueo])

  // Cierra con Escape (solo si no hay confirm abierto)
  useEffect(() => {
    if (!bloqueo) return
    const handler = (e) => {
      if (e.key === 'Escape' && !confirmOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bloqueo, onClose, confirmOpen])

  if (!bloqueo) return null

  const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''

  const formatFecha = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const fecha = d.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    // Capitaliza primera letra: "viernes, 10 de abril de 2026" → "Viernes, 10 de abril de 2026"
    const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1)
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${fechaCap} a las ${hora} hs`
  }

  const { cliente, motivo, created_at,
          miembro_apellido, miembro_nombre, miembro_dni, miembro_rol } = bloqueo
  const clienteNombre = `${cliente.apellido}, ${cliente.nombre}`
  // Se pasa 'PROPIETARIO' para que la distinción "de Empresa" aplique cuando hay 2+ sucursales
  const rolLabel = miembro_rol ? getRolLabel(miembro_rol, numSucursales, 'PROPIETARIO') : null

  const handleDesbloquear = async () => {
    setLoading(true)
    try {
      await sucursalService.desbloquearCliente(sucursalId, cliente.id)
      onDesbloqueado?.(cliente.id)
    } catch (err) {
      onError?.(err)
    } finally {
      setConfirmOpen(false)
      setLoading(false)
    }
  }

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal" onClick={(e) => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA ═══ */}
        <div className="tdmodal__header">
          <h3>Detalle de bloqueo</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="tdmodal__body">

          {/* ── Filas de información ── */}
          <div className="tdmodal__info">

            {/* 👤 Nombre del cliente */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">👤</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Cliente:</span>
                <span className="tdmodal__row-val">{clienteNombre}</span>
              </div>
            </div>

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

            {/* ☎️ Teléfono */}
            {cliente.telefono && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon bdmodal__tel-icon">☎️</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Teléfono:</span>
                  <span className="tdmodal__row-val">
                    {cliente.telefono}
                    {cliente.telefono2 && <> · {cliente.telefono2}</>}
                  </span>
                </div>
              </div>
            )}

            {/* 📝 Observación del cliente */}
            {cliente.observacion && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">📝</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Observación:</span>
                  <span className="tdmodal__row-val cdmodal__observacion">{cliente.observacion}</span>
                </div>
              </div>
            )}

            {/* 👥 Bloqueado por: apellido, nombre (DNI xxx) + badge de rol */}
            <div className="tdmodal__row bdmodal__por-row">
              <span className="tdmodal__row-icon">👥</span>
              <div className="bdmodal__por-inner">
                <span className="bdmodal__por-texto">
                  <span className="tdmodal__row-label">Bloqueado por:</span>
                  <span className="tdmodal__row-val">
                    {miembro_apellido}, {miembro_nombre}
                    {miembro_dni && ` (DNI ${formatDni(miembro_dni)})`}
                  </span>
                </span>
                {rolLabel && (
                  <span className={`bdmodal__rol-badge ${ROL_CLASS[miembro_rol] ?? ''}`}>
                    {rolLabel}
                  </span>
                )}
              </div>
            </div>

            {/* 🚫 Motivo del bloqueo */}
            {motivo && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">🚫</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Motivo:</span>
                  <span className="tdmodal__row-val cdmodal__observacion">{motivo}</span>
                </div>
              </div>
            )}

            {/* 📅 Fecha y hora de bloqueo */}
            <div className="tdmodal__row">
              <span className="tdmodal__row-icon">📅</span>
              <div className="tdmodal__row-body">
                <span className="tdmodal__row-label">Fecha y hora de bloqueo:</span>
                <span className="tdmodal__row-val">{formatFecha(created_at)}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ═══ ACCIONES ═══ */}
        <div className="tdmodal__actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cerrar</button>
          <button className="btn btn-danger" onClick={() => setConfirmOpen(true)} disabled={loading}>
            Desbloquear
          </button>
        </div>
      </div>

      {/* ═══ CONFIRM: desbloquear ═══ */}
      {confirmOpen && (
        <ConfirmModal
          icon="🔓"
          message="¿Deseás desbloquear este cliente?"
          confirmText="Desbloquear"
          confirmVariant="btn-danger"
          loading={loading}
          onConfirm={handleDesbloquear}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  )
}
