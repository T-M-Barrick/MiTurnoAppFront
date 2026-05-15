import { useState, useRef } from 'react'
import { sucursalService } from '../../services/sucursalService'
import { useFooterLayout } from '../../utils/useFooterLayout'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import ErrorModal from '../ErrorModal/ErrorModal'
import '../MiembroDetailModal/MiembroDetailModal.css'

const ROL_LABEL = {
  GERENTE_SUCURSAL: 'Gerente de sucursal',
  EMPLEADO:         'Empleado',
}
const ROL_CLASS = {
  GERENTE_SUCURSAL: 'mmdetail__badge--gerente-sucursal',
  EMPLEADO:         'mmdetail__badge--empleado',
}

/**
 * Modal para gestionar a un miembro dentro de una sucursal específica.
 * Aparece encima del MiembroDetailModal cuando se selecciona una sucursal
 * en el dropdown de multi-sucursal.
 *
 * Props:
 *   miembro   — { id, nombre, apellido, ... }
 *   sucursal  — { id, nombre, rol }
 *   onClose   — cierra este modal
 *   onUpdated — callback(updatedData) tras cambio de rol
 *   onDeleted — callback() tras eliminar de la sucursal
 *   onError   — callback(err)
 */
export default function SucursalMiembroDetailModal({ miembro, sucursal, onClose, onUpdated, onDeleted, onError }) {
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [confirmModificar, setConfirmModificar] = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [successMsg,       setSuccessMsg]       = useState(null)
  const pendingUpdateRef = useRef(null)

  const actionsRef  = useRef(null)
  const actionsMode = useFooterLayout(actionsRef)

  // Rol alternativo: toggle entre los dos roles de sucursal
  const otroRol      = sucursal.rol === 'GERENTE_SUCURSAL' ? 'EMPLEADO' : 'GERENTE_SUCURSAL'
  const otroRolLabel = ROL_LABEL[otroRol]

  /* ── Eliminar de esta sucursal ── */
  const handleDelete = async () => {
    setLoading(true)
    try {
      await sucursalService.deleteMiembroSucursal(sucursal.id, miembro.id)
      onDeleted?.()
    } catch (err) {
      onError?.(err)
    } finally {
      setConfirmDelete(false)
      setLoading(false)
    }
  }

  /* ── Modificar rol dentro de esta sucursal (toggle GERENTE_SUCURSAL ↔ EMPLEADO) ── */
  const handleModificarRol = async () => {
    setLoading(true)
    try {
      const payload = { nuevo_rol: otroRol, sucursal_id: sucursal.id }
      const data    = await sucursalService.updateMiembroRolSucursal(sucursal.id, miembro.id, payload)
      pendingUpdateRef.current = data
      setSuccessMsg('El rol fue modificado con éxito.')
    } catch (err) {
      onError?.(err)
    } finally {
      setConfirmModificar(false)
      setLoading(false)
    }
  }

  return (
    <>
      {/* Overlay sobre el MiembroDetailModal */}
      <div className="mmdetail-form-overlay" role="dialog" aria-modal="true" aria-label="Gestionar en sucursal">
        <div className="tdmodal mmdetail mmdetail--form-view mmdetail--sucursal-view" onClick={e => e.stopPropagation()}>
          <div className="tdmodal__handle" />

          {/* Cabecera con nombre de la sucursal */}
          <div className="tdmodal__header">
            <h3>{sucursal.nombre ?? `Sucursal ${sucursal.id}`}</h3>
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar" disabled={loading}>✕</button>
          </div>

          {/* Cuerpo */}
          <div className="tdmodal__body">
            {/* Nombre del miembro + badge de rol arriba a la derecha */}
            <div className="tdsumodal__top-row">
              <div className="tdsumodal__cliente-row">
                <div className="tdmodal__row">
                  <span className="tdmodal__row-icon">👤</span>
                  <div className="tdmodal__row-body">
                    <span className="tdmodal__row-label">Miembro:</span>
                    <span className="tdmodal__row-val">{miembro.apellido}, {miembro.nombre}</span>
                  </div>
                </div>
              </div>
              {sucursal.rol && (
                <span className={`tdmodal__badge mmdetail__badge mmdetail__badge--sucursal-view ${ROL_CLASS[sucursal.rol] ?? ''}`}>
                  {ROL_LABEL[sucursal.rol] ?? sucursal.rol}
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div ref={actionsRef} className={`tdmodal__actions mmdetail__actions mmdetail__actions--form tdmodal__actions--${actionsMode}`}>
            <button className="btn btn-ghost"   onClick={onClose}                          disabled={loading}>Cerrar</button>
            <button className="btn btn-orange"  onClick={() => setConfirmDelete(true)}     disabled={loading}>Eliminar</button>
            <button className="btn btn-indigo"  onClick={() => setConfirmModificar(true)}  disabled={loading}>Modificar rol</button>
          </div>
        </div>
      </div>

      {/* Confirmar eliminar de sucursal */}
      {confirmDelete && (
        <ConfirmModal
          icon="⚠️"
          message={`¿Deseás eliminar a ${miembro.nombre} ${miembro.apellido} de ${sucursal.nombre ?? 'esta sucursal'}?`}
          confirmText="Eliminar"
          confirmVariant="btn-orange"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Confirmar cambio de rol */}
      {confirmModificar && (
        <ConfirmModal
          icon="ℹ️"
          message={`¿Cambiar el rol de ${miembro.nombre} ${miembro.apellido} a ${otroRolLabel} en ${sucursal.nombre ?? 'esta sucursal'}?`}
          confirmText="Confirmar"
          confirmVariant="btn-indigo"
          loading={loading}
          onConfirm={handleModificarRol}
          onCancel={() => setConfirmModificar(false)}
        />
      )}

      <ErrorModal
        success={successMsg}
        onClose={() => {
          setSuccessMsg(null)
          onUpdated?.(pendingUpdateRef.current)  // propaga al padre; detail modal queda abierto
          pendingUpdateRef.current = null
          onClose()                              // cierra este modal de sucursal
        }}
      />
    </>
  )
}
