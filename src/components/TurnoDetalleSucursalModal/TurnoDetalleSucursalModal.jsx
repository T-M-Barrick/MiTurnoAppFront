import { useState, useEffect } from 'react'
import { formatFechaCompleta, labelEstado } from '../../utils/dateUtils'
import { sucursalService } from '../../services/sucursalService'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import '../../styles/DetailModal.css'

/**
 * Formatea duración en palabras: "1 hora", "2 horas", "30 minutos", etc.
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
 * Modal de detalle de turno para el contexto de empresa/sucursal (TurnoSucursalOut).
 * Muestra las filas de info con el mismo formato que el modal de usuario.
 * Sin dirección ni recordatorio. Con DNI y email del cliente.
 *
 * Props:
 *   turno       — objeto TurnoSucursalOut | null
 *   sucursalId  — id de la sucursal
 *   onClose     — cerrar el modal
 *   onUpdated   — callback(turnoActualizado) al cambiar estado
 *   onDeleted   — callback(turnoId) al eliminar
 *   onError     — callback(errorObj) para mostrar ErrorModal
 */
export default function TurnoDetalleSucursalModal({ turno, sucursalId, onClose, onUpdated, onDeleted, onError, readOnly = false }) {

  const [confirmAction, setConfirmAction] = useState(null)
  const [motivo,        setMotivo]        = useState('')
  const [loadingAction, setLoadingAction] = useState(false)

  useEffect(() => {
    if (!turno) return
    setConfirmAction(null)
    setMotivo('')
  }, [turno])

  useEffect(() => {
    if (!turno) return
    const handler = (e) => {
      if (e.key === 'Escape' && !confirmAction) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [turno, onClose, confirmAction])

  if (!turno) return null

  const ahora       = Date.now()
  const inicioTurno = new Date(turno.fecha_hora).getTime()
  const finTurno    = inicioTurno + turno.duracion * 60 * 1000
  let estadoVisible = turno.estado_turno
  if (turno.estado_turno === 'CONFIRMADO') {
    if      (ahora >= finTurno)    estadoVisible = 'VENCIDO'
    else if (ahora >= inicioTurno) estadoVisible = 'EN_HORA'
  }

  const esCancelable = estadoVisible === 'CONFIRMADO'
  const esVencido    = estadoVisible === 'VENCIDO'
  const esEnHora     = estadoVisible === 'EN_HORA'
  const ESTADOS_DELETABLES = ['CANCELADO_POR_USUARIO', 'CANCELADO_POR_EMPRESA', 'CUMPLIDO', 'NO_CUMPLIDO']
  const esDeletable  = ESTADOS_DELETABLES.includes(turno.estado_turno)

  const fechaDisplay = formatFechaCompleta(turno.fecha_hora)
    .replace(/^[a-záéíóúüñ]+/i, (d) => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase())

  const formatDni = (dni) => {
    if (!dni) return null
    return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const profesional = turno.profesional_apellido
    ? `${turno.profesional_apellido}, ${turno.profesional_nombre}${turno.profesional_dni ? ` (DNI ${formatDni(turno.profesional_dni)})` : ''}`
    : null

  const clienteNombre = `${turno.cliente_apellido}, ${turno.cliente_nombre}`
  const clienteDni    = formatDni(turno.cliente_dni)

  const handleDelete = async () => {
    setLoadingAction(true)
    try {
      await sucursalService.deleteTurnos(sucursalId, [turno.id])
      onDeleted?.(turno.id)
    } catch (err) {
      onError(err)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleAbrirConfirm = (action) => {
    setMotivo('')
    setConfirmAction(action)
  }

  const handleConfirmAction = async () => {
    setLoadingAction(true)
    const motivoFinal = motivo.trim() || null
    try {
      if (confirmAction === 'cancel') {
        const updated = await sucursalService.updateEstadoTurno(sucursalId, turno.id, {
          estado_turno: 'CANCELADO_POR_EMPRESA', motivo: motivoFinal,
        })
        onUpdated?.(updated)

      } else if (confirmAction === 'cumplido') {
        const updated = await sucursalService.updateEstadoTurno(sucursalId, turno.id, {
          estado_turno: 'CUMPLIDO', motivo: null,
        })
        onUpdated?.(updated)

      } else if (confirmAction === 'no_cumplido') {
        const updated = await sucursalService.updateEstadoTurno(sucursalId, turno.id, {
          estado_turno: 'NO_CUMPLIDO', motivo: null,
        })
        onUpdated?.(updated)
      }
    } catch (err) {
      onError(err)
    } finally {
      setConfirmAction(null)
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

  const MotivoField = (
    <div className="tdsumodal__motivo">
      <label className="tdsumodal__motivo-label">Motivo (opcional):</label>
      <textarea
        className="tdsumodal__motivo-input"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ingresá un motivo..."
        maxLength={255}
        rows={3}
        disabled={loadingAction}
      />
    </div>
  )

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal" onClick={(e) => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA sticky ═══ */}
        <div className="tdmodal__header">
          <h3>Detalle del turno</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="tdmodal__body">

          {/* ── Fila superior: badge (der, arriba) + info (izq, ligeramente abajo) ── */}
          <div className="tdsumodal__top-row">
            <div className="tdsumodal__cliente-row">
              {/* 👤 Cliente */}
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">👤</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Cliente:</span>
                  <span className="tdmodal__row-val">{clienteNombre}</span>
                </div>
              </div>
            </div>
            <div className="tdsumodal__badge-wrap">
              <span className={`tdmodal__badge ${badgeClass}`}>{labelEstado(estadoVisible)}</span>
            </div>
          </div>

          {/* ── Filas de información ── */}
          <div className="tdmodal__info">

            {/* 🪪 DNI del cliente */}
            {clienteDni && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon tdsumodal__dni-icon">🪪</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">DNI:</span>
                  <span className="tdmodal__row-val">{clienteDni}</span>
                </div>
              </div>
            )}

            {/* 📧 Email del cliente */}
            {turno.cliente_email && (
              <div className="tdmodal__row">
                <span className="tdmodal__row-icon">📧</span>
                <div className="tdmodal__row-body">
                  <span className="tdmodal__row-label">Email:</span>
                  <span className="tdmodal__row-val">{turno.cliente_email}</span>
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

          </div>
        </div>

        {/* ═══ ACCIONES ═══ */}
        <div className={`tdmodal__actions${readOnly ? ' tdmodal__actions--center' : ''}`}>

          {/* Solo lectura (historial): únicamente Cerrar centrado */}
          {readOnly && (
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          )}

          {!readOnly && esCancelable && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn-danger" onClick={() => handleAbrirConfirm('cancel')}>
                Cancelar turno
              </button>
            </>
          )}
          {!readOnly && esEnHora && (
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          )}
          {!readOnly && esVencido && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              <button className="btn btn-orange" onClick={() => handleAbrirConfirm('cumplido')}>
                Cumplido
              </button>
              <button className="btn btn-indigo" onClick={() => handleAbrirConfirm('no_cumplido')}>
                No cumplido
              </button>
            </>
          )}
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

      {confirmAction === 'cancel' && (
        <ConfirmModal icon="🚫" message="¿Confirmás la cancelación del turno?"
          confirmText="Sí, cancelar" confirmVariant="btn-danger"
          loading={loadingAction} onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}>
          {MotivoField}
        </ConfirmModal>
      )}
      {confirmAction === 'cumplido' && (
        <ConfirmModal icon="✅" message="¿Deseás marcar este turno como cumplido?"
          confirmText="Confirmar" confirmVariant="btn-orange"
          loading={loadingAction} onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'no_cumplido' && (
        <ConfirmModal icon="❌" message="¿Deseás marcar este turno como no cumplido?"
          confirmText="Confirmar" confirmVariant="btn-indigo"
          loading={loadingAction} onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
