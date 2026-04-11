import { useState } from 'react'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import CustomSelect from '../CustomSelect/CustomSelect'
import { getRolLabel as getRolLabelCtx } from '../../utils/rolUtils'
import './MiembroDetailModal.css'

// Jerarquía numérica de roles para comparar rangos
const ROL_RANK = {
  PROPIETARIO:      4,
  GERENTE_EMPRESA:  3,
  GERENTE_SUCURSAL: 2,
  EMPLEADO:         1,
}

// Etiquetas y jerarquía de roles
const ROL_LABEL = {
  PROPIETARIO:      'Propietario',
  GERENTE_EMPRESA:  'Gerente de empresa',
  GERENTE_SUCURSAL: 'Gerente de sucursal',
  EMPLEADO:         'Empleado',
}

const ROL_CLASS = {
  PROPIETARIO:      'mmdetail__badge--propietario',
  GERENTE_EMPRESA:  'mmdetail__badge--gerente-empresa',
  GERENTE_SUCURSAL: 'mmdetail__badge--gerente-sucursal',
  EMPLEADO:         'mmdetail__badge--empleado',
}

// Roles disponibles para asignar según el rango del solicitante y cantidad de sucursales.
// Con una sola sucursal, GERENTE_SUCURSAL no existe: se muestra "Gerente" → GERENTE_EMPRESA.
const ROLES_PROPIETARIO_MULTI  = ['PROPIETARIO', 'GERENTE_EMPRESA', 'GERENTE_SUCURSAL', 'EMPLEADO']
const ROLES_PROPIETARIO_SINGLE = ['PROPIETARIO', 'GERENTE_EMPRESA', 'EMPLEADO']
const ROLES_GERENTE_EMPRESA_MULTI  = ['GERENTE_SUCURSAL', 'EMPLEADO']
const ROLES_GERENTE_EMPRESA_SINGLE = ['EMPLEADO']
const ROLES_SUCURSAL = ['GERENTE_SUCURSAL', 'EMPLEADO']

// Etiqueta para el selector de "modificar rol" (override simple por sucursal única)
function getRolLabel(rol, esSucursalUnica) {
  if (esSucursalUnica && rol === 'GERENTE_EMPRESA') return 'Gerente'
  return ROL_LABEL[rol] ?? rol
}


const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? '—'

/**
 * Modal de detalle de un miembro.
 *
 * Props:
 *   miembro        — objeto normalizado { miembro, tipo, rolEmpresa, sucursales }
 *   empresaId      — id de la empresa
 *   sucursales     — lista de todas las sucursales de la empresa
 *   miRol          — rol del usuario logueado ('PROPIETARIO' | 'GERENTE_EMPRESA')
 *   onClose        — cierra el modal
 *   onUpdated      — callback() tras modificar (refetch en la página)
 *   onDeleted      — callback() tras eliminar
 *   onError        — callback(errorObj)
 */
export default function MiembroDetailModal({ miembro: miembroNorm, empresaId, sucursales, miRol, userId, onClose, onUpdated, onDeleted, onError }) {
  const { miembro, tipo, rolEmpresa, sucursales: miSucursales } = miembroNorm

  // Vista: 'detail' | 'modificar-rol' | 'agregar-sucursal'
  const [view,          setView]          = useState('detail')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading,       setLoading]       = useState(false)

  // Estado para "Modificar rol"
  const [nuevoRol,            setNuevoRol]            = useState('')
  const [sucursalParaRol,     setSucursalParaRol]     = useState('')
  const [errNuevoRol,         setErrNuevoRol]         = useState(null)
  const [errSucursalParaRol,  setErrSucursalParaRol]  = useState(null)

  // Estado para "Agregar a sucursal"
  const [sucursalParaAdd,    setSucursalParaAdd]    = useState('')
  const [rolParaAdd,         setRolParaAdd]         = useState('')
  const [errSucursalParaAdd, setErrSucursalParaAdd] = useState(null)
  const [errRolParaAdd,      setErrRolParaAdd]      = useState(null)

  // Roles disponibles según rol del solicitante y cantidad de sucursales
  const esSucursalUnica  = sucursales.length === 1
  const rolesDisponibles = miRol === 'PROPIETARIO'
    ? (esSucursalUnica ? ROLES_PROPIETARIO_SINGLE  : ROLES_PROPIETARIO_MULTI)
    : (esSucursalUnica ? ROLES_GERENTE_EMPRESA_SINGLE : ROLES_GERENTE_EMPRESA_MULTI)
  const esBranchRolNuevo = ROLES_SUCURSAL.includes(nuevoRol)

  // Sucursales donde el miembro AÚN no está (para "Agregar a sucursal")
  const sucursalesDisponiblesAdd = sucursales.filter(s =>
    !miSucursales.some(ms => ms.id === s.id)
  )

  const rolActual = rolEmpresa ?? miSucursales?.[0]?.rol

  // Puede actuar sobre este miembro solo si no es uno mismo y tiene mayor rango
  const esSelf      = miembro.id === userId
  const puedeActuar = !esSelf && (ROL_RANK[miRol] ?? 0) > (ROL_RANK[rolActual] ?? 0)

  /* ── Modificar rol ── */
  const handleModificarRol = async () => {
    let hasErr = false
    if (!nuevoRol) { setErrNuevoRol('Seleccioná un rol'); hasErr = true }
    if (esBranchRolNuevo && !sucursalParaRol) { setErrSucursalParaRol('Seleccioná una sucursal'); hasErr = true }
    if (hasErr) return

    setLoading(true)
    try {
      const payload = { nuevo_rol: nuevoRol }
      if (esBranchRolNuevo) payload.sucursal_id = Number(sucursalParaRol)
      await empresaService.updateMiembroRol(empresaId, miembro.id, payload)
      onUpdated?.()
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Eliminar de empresa ── */
  const handleDelete = async () => {
    setLoading(true)
    try {
      await empresaService.deleteMiembro(empresaId, miembro.id)
      onDeleted?.()
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Agregar a sucursal ── */
  const handleAgregarSucursal = async () => {
    let hasErr = false
    if (!sucursalParaAdd) { setErrSucursalParaAdd('Seleccioná una sucursal'); hasErr = true }
    if (!rolParaAdd)      { setErrRolParaAdd('Seleccioná un rol');             hasErr = true }
    if (hasErr) return

    setLoading(true)
    try {
      await sucursalService.addMiembroSucursal(Number(sucursalParaAdd), miembro.id, { rol: rolParaAdd })
      onUpdated?.()
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  const resetView = () => {
    setView('detail')
    setNuevoRol(''); setSucursalParaRol('')
    setErrNuevoRol(null); setErrSucursalParaRol(null)
    setSucursalParaAdd(''); setRolParaAdd('')
    setErrSucursalParaAdd(null); setErrRolParaAdd(null)
  }

  return (
    <div className="tdmodal-overlay">
      <div className={`tdmodal mmdetail${view !== 'detail' ? ' mmdetail--form-view' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA ═══ */}
        <div className="tdmodal__header">
          <h3>
            {view === 'detail'          && 'Detalle del miembro'}
            {view === 'modificar-rol'   && 'Modificar rol'}
            {view === 'agregar-sucursal'&& 'Agregar a sucursal'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar" disabled={loading}>✕</button>
        </div>

        {/* ═══ CUERPO ═══ */}
        <div className="tdmodal__body">

          {/* ── Vista: detalle ── */}
          {view === 'detail' && (
            <>
              {/* Nombre + rol */}
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
                {/* Badge de rol actual */}
                {rolActual && (
                  <span className={`tdmodal__badge mmdetail__badge ${ROL_CLASS[rolActual] ?? ''}`}>
                    {getRolLabelCtx(rolActual, sucursales.length, miRol)}
                  </span>
                )}
              </div>

              <div className="tdmodal__info">
                {/* DNI */}
                <div className="tdmodal__row">
                  <span className="tdmodal__row-icon" style={{ position: 'relative', top: -2 }}>🪪</span>
                  <div className="tdmodal__row-body">
                    <span className="tdmodal__row-label">DNI:</span>
                    <span className="tdmodal__row-val">{formatDni(miembro.dni)}</span>
                  </div>
                </div>

                {/* Email */}
                <div className="tdmodal__row">
                  <span className="tdmodal__row-icon">📧</span>
                  <div className="tdmodal__row-body">
                    <span className="tdmodal__row-label">Email:</span>
                    <span className="tdmodal__row-val">{miembro.email}</span>
                  </div>
                </div>

                {/* Sucursales (solo miembros de sucursal) */}
                {tipo === 'sucursal' && miSucursales.length > 0 && (
                  <div className="tdmodal__row">
                    <span className="tdmodal__row-icon">🏪</span>
                    <div className="tdmodal__row-body">
                      <span className="tdmodal__row-label">Sucursal{miSucursales.length > 1 ? 'es' : ''}:</span>
                      <span className="tdmodal__row-val">
                        {miSucursales.map((s, i) => (
                          <span key={s.id}>
                            {s.nombre ?? `Sucursal ${s.id}`}
                            <span className="mmdetail__suc-rol"> ({ROL_LABEL[s.rol] ?? s.rol})</span>
                            {i < miSucursales.length - 1 && ' · '}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Vista: modificar rol ── */}
          {view === 'modificar-rol' && (
            <div className="mmdetail__form">
              <div className="form-group">
                <label>Nuevo rol <span className="mmdetail__req">*</span></label>
                <CustomSelect
                  options={[
                    { value: '', label: '— Seleccioná un rol —' },
                    ...rolesDisponibles.map(r => ({ value: r, label: getRolLabel(r, esSucursalUnica) })),
                  ]}
                  value={nuevoRol}
                  onChange={val => { setNuevoRol(val); setSucursalParaRol(''); setErrNuevoRol(null) }}
                  width="100%"
                  height={44}
                  disabled={loading}
                  className={errNuevoRol ? 'error' : ''}
                />
                {errNuevoRol && <p className="form-error">{errNuevoRol}</p>}
              </div>

              {esBranchRolNuevo && (
                <div className="form-group">
                  <label>Sucursal <span className="mmdetail__req">*</span></label>
                  <CustomSelect
                    options={[
                      { value: '', label: '— Seleccioná una sucursal —' },
                      ...sucursales.map(s => ({ value: String(s.id), label: s.nombre ?? `Sucursal ${s.id}` })),
                    ]}
                    value={sucursalParaRol}
                    onChange={val => { setSucursalParaRol(val); setErrSucursalParaRol(null) }}
                    width="100%"
                    height={44}
                    disabled={loading}
                    className={errSucursalParaRol ? 'error' : ''}
                  />
                  {errSucursalParaRol && <p className="form-error">{errSucursalParaRol}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── Vista: agregar a sucursal ── */}
          {view === 'agregar-sucursal' && (
            <div className="mmdetail__form">
              <div className="form-group">
                <label>Sucursal <span className="mmdetail__req">*</span></label>
                <CustomSelect
                  options={[
                    { value: '', label: '— Seleccioná una sucursal —' },
                    ...sucursalesDisponiblesAdd.map(s => ({ value: String(s.id), label: s.nombre ?? `Sucursal ${s.id}` })),
                  ]}
                  value={sucursalParaAdd}
                  onChange={val => { setSucursalParaAdd(val); setErrSucursalParaAdd(null) }}
                  width="100%"
                  height={44}
                  disabled={loading}
                  className={errSucursalParaAdd ? 'error' : ''}
                />
                {errSucursalParaAdd && <p className="form-error">{errSucursalParaAdd}</p>}
              </div>
              <div className="form-group">
                <label>Rol <span className="mmdetail__req">*</span></label>
                <CustomSelect
                  options={[
                    { value: '', label: '— Seleccioná un rol —' },
                    { value: 'GERENTE_SUCURSAL', label: 'Gerente de sucursal' },
                    { value: 'EMPLEADO',         label: 'Empleado' },
                  ]}
                  value={rolParaAdd}
                  onChange={val => { setRolParaAdd(val); setErrRolParaAdd(null) }}
                  width="100%"
                  height={44}
                  disabled={loading}
                  className={errRolParaAdd ? 'error' : ''}
                />
                {errRolParaAdd && <p className="form-error">{errRolParaAdd}</p>}
              </div>
            </div>
          )}

        </div>

        {/* ═══ ACCIONES ═══ */}
        <div className={`tdmodal__actions mmdetail__actions${view !== 'detail' ? ' mmdetail__actions--form' : ''}`}>

          {view === 'detail' && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>

              {puedeActuar && (
                <>
                  {/* Agregar a sucursal — solo si hay más de una y el miembro no está en todas */}
                  {sucursales.length > 1 && sucursalesDisponiblesAdd.length > 0 && (
                    <button className="btn btn-secondary" onClick={() => setView('agregar-sucursal')} disabled={loading}>
                      + Sucursal
                    </button>
                  )}

                  <button className="btn btn-primary" onClick={() => setView('modificar-rol')} disabled={loading}>
                    Modificar rol
                  </button>

                  <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={loading}>
                    Eliminar
                  </button>
                </>
              )}
            </>
          )}

          {(view === 'modificar-rol' || view === 'agregar-sucursal') && (
            <>
              <button className="btn btn-ghost" onClick={resetView} disabled={loading}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={view === 'modificar-rol' ? handleModificarRol : handleAgregarSucursal}
                disabled={loading}
              >
                {loading ? <><span className="spinner spinner-sm" /> Guardando…</> : 'Confirmar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ConfirmModal eliminar */}
      {confirmDelete && (
        <ConfirmModal
          icon="⚠️"
          message={`¿Eliminar a ${miembro.nombre} ${miembro.apellido} de la empresa?`}
          confirmText="Eliminar"
          confirmVariant="btn-danger"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
