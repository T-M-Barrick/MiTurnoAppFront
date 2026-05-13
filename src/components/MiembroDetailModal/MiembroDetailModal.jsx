import { useState, useRef } from 'react'
import { useFooterLayout } from '../../utils/useFooterLayout'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import ConfirmModal from '../ConfirmModal/ConfirmModal'
import ErrorModal from '../ErrorModal/ErrorModal'
import CustomSelect from '../CustomSelect/CustomSelect'
import SucursalMiembroDetailModal from '../SucursalMiembroDetailModal/SucursalMiembroDetailModal'
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
// Cuando el miembro es de sucursal y la empresa tiene 2+ sucursales, solo el propietario
// puede subirlo a un rol de empresa (PROPIETARIO o GERENTE_EMPRESA).
const ROLES_PROPIETARIO_DESDE_MULTI_SUC = ['PROPIETARIO', 'GERENTE_EMPRESA']

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
 *   onUpdated      — callback(data) tras modificar
 *   onDeleted      — callback() tras eliminar
 *   onError        — callback(errorObj)
 */
export default function MiembroDetailModal({ miembro: miembroNorm, empresaId, sucursales, miRol, userId, onClose, onUpdated, onDeleted, onError }) {
  const { miembro, tipo, rolEmpresa, sucursales: miSucursales } = miembroNorm

  // formView: null | 'modificar-rol' | 'agregar-sucursal'
  const [formView,             setFormView]             = useState(null)
  const [confirmDelete,        setConfirmDelete]        = useState(false)
  const [loading,              setLoading]              = useState(false)
  const [successMsg,           setSuccessMsg]           = useState(null)
  const [selectedSucursalModal, setSelectedSucursalModal] = useState(null) // sucursal elegida del dropdown multi-sucursal
  const pendingUpdateRef  = useRef(null) // guarda data del back hasta que el usuario acepta el success
  const actionsRef        = useRef(null)
  const formActionsRef    = useRef(null)
  const actionsMode       = useFooterLayout(actionsRef)
  const formActionsMode   = useFooterLayout(formActionsRef)

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

  const esSucursalUnica  = sucursales.length === 1

  // Sucursales activas donde el miembro AÚN no está (para "Agregar a sucursal")
  const sucursalesActivas        = sucursales.filter(s => s.activa !== false)
  const sucursalesDisponiblesAdd = sucursalesActivas.filter(s =>
    !miSucursales.some(ms => ms.id === s.id)
  )

  // Multi-sucursal: miembro de sucursal en empresa con 2+ sucursales activas
  const esMultiSucursal = tipo === 'sucursal' && sucursalesActivas.length > 1

  // Roles candidatos según rango del solicitante y cantidad de sucursales
  const rolesCandidatos = esMultiSucursal
    ? ROLES_PROPIETARIO_DESDE_MULTI_SUC
    : (miRol === 'PROPIETARIO'
      ? (esSucursalUnica ? ROLES_PROPIETARIO_SINGLE  : ROLES_PROPIETARIO_MULTI)
      : (esSucursalUnica ? ROLES_GERENTE_EMPRESA_SINGLE : ROLES_GERENTE_EMPRESA_MULTI))

  // Rol actual del miembro a excluir del selector (no tiene sentido asignar el mismo que ya tiene)
  const rolAExcluir = tipo === 'empresa' ? rolEmpresa : (esMultiSucursal ? null : miSucursales[0]?.rol)
  const rolesDisponibles = rolesCandidatos.filter(r => r !== rolAExcluir)

  const esBranchRolNuevo         = ROLES_SUCURSAL.includes(nuevoRol)
  // Selector de sucursal solo cuando el nuevo rol es de sucursal y el miembro es de empresa
  const necesitaSucursalSelector = esBranchRolNuevo && tipo === 'empresa'

  // Rol para badge: null si el miembro tiene distintos roles en sus sucursales
  const rolUnicoSucursal = miSucursales.length > 1
    ? (miSucursales.every(s => s.rol === miSucursales[0]?.rol) ? miSucursales[0]?.rol : null)
    : miSucursales[0]?.rol
  const rolActual = rolEmpresa ?? rolUnicoSucursal

  // Rol para permisos: el más alto entre todas sus sucursales (para no subestimar el rango)
  const rolPermisos = rolEmpresa ?? (miSucursales.length > 0
    ? miSucursales.reduce((max, s) => (ROL_RANK[s.rol] ?? 0) > (ROL_RANK[max] ?? 0) ? s.rol : max, miSucursales[0]?.rol)
    : null)

  // Puede actuar sobre este miembro solo si no es uno mismo y tiene mayor rango
  const esSelf      = miembro.id === userId
  const puedeActuar = !esSelf && (ROL_RANK[miRol] ?? 0) > (ROL_RANK[rolPermisos] ?? 0)

  // Solo PROPIETARIO y GERENTE_EMPRESA pueden modificar roles; en multi-sucursal solo el propietario
  const puedeModificarRol = puedeActuar && ['PROPIETARIO', 'GERENTE_EMPRESA'].includes(miRol) && (!esMultiSucursal || miRol === 'PROPIETARIO')

  /** Limpia el formulario y cierra el modal de form. */
  const resetForm = () => {
    setFormView(null)
    setNuevoRol(''); setSucursalParaRol('')
    setErrNuevoRol(null); setErrSucursalParaRol(null)
    setSucursalParaAdd(''); setRolParaAdd('')
    setErrSucursalParaAdd(null); setErrRolParaAdd(null)
  }

  /* ── Modificar rol ── */
  const handleModificarRol = async () => {
    let hasErr = false
    if (!nuevoRol) { setErrNuevoRol('Seleccioná un rol'); hasErr = true }
    if (necesitaSucursalSelector && !sucursalParaRol) { setErrSucursalParaRol('Seleccioná una sucursal'); hasErr = true }
    if (hasErr) return

    setLoading(true)
    try {
      let data
      if (tipo === 'sucursal') {
        // El miembro es Miembro_Sucursal: endpoint de sucursal
        const sucId = miSucursales[0].id
        const payload = { nuevo_rol: nuevoRol, sucursal_id: esBranchRolNuevo ? sucId : null }
        data = await sucursalService.updateMiembroRolSucursal(sucId, miembro.id, payload)
      } else {
        // El miembro es Miembro_Empresa: endpoint de empresa
        const payload = { nuevo_rol: nuevoRol, sucursal_id: necesitaSucursalSelector ? Number(sucursalParaRol) : null }
        data = await empresaService.updateMiembroRol(empresaId, miembro.id, payload)
      }
      pendingUpdateRef.current = data
      setSuccessMsg('El rol fue modificado con éxito.')
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  /* ── Eliminar de empresa o sucursal (solo modo non-multi) ── */
  const handleDelete = async () => {
    setLoading(true)
    try {
      if (tipo === 'sucursal') {
        await sucursalService.deleteMiembroSucursal(miSucursales[0].id, miembro.id)
      } else {
        await empresaService.deleteMiembro(empresaId, miembro.id)
      }
      onDeleted?.()
    } catch (err) {
      onError?.(err)
    } finally {
      setConfirmDelete(false)
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
      const data = await sucursalService.addMiembroSucursal(Number(sucursalParaAdd), miembro.id, { rol: rolParaAdd })
      pendingUpdateRef.current = data
      setSuccessMsg('El miembro fue agregado a la sucursal con éxito.')
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Modal de detalle — siempre visible ── */}
      <div className="tdmodal-overlay">
        <div className={`tdmodal mmdetail${formView || selectedSucursalModal ? ' mmdetail--dimmed' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="tdmodal__handle" />

          {/* ═══ CABECERA ═══ */}
          <div className="tdmodal__header">
            <h3>Detalle del miembro</h3>
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar" disabled={loading}>✕</button>
          </div>

          {/* ═══ CUERPO ═══ */}
          <div className="tdmodal__body">
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

              {/* Sucursales — oculto para GERENTE_SUCURSAL y EMPLEADO (ya saben a qué sucursal pertenecen) */}
              {tipo === 'sucursal' && miSucursales.length > 0 && !['GERENTE_SUCURSAL', 'EMPLEADO'].includes(miRol) && (
                <div className="tdmodal__row">
                  <span className="tdmodal__row-icon">🏪</span>
                  <div className="tdmodal__row-body" style={{ flex: 1 }}>
                    {esMultiSucursal ? (
                      /* Label + dropdown inline para seleccionar qué sucursal gestionar */
                      <div className="mmdetail__suc-select-row">
                        <span className="tdmodal__row-label">Sucursales:</span>
                        <CustomSelect
                          options={[
                            { value: '', label: '— Ver sucursal —' },
                            ...miSucursales.map(s => ({
                              value: String(s.id),
                              label: `${s.nombre ?? `Sucursal ${s.id}`} — ${ROL_LABEL[s.rol] ?? s.rol}`,
                            })),
                          ]}
                          value=""
                          onChange={val => {
                            if (!val) return
                            const suc = miSucursales.find(s => String(s.id) === val)
                            if (suc) setSelectedSucursalModal(suc)
                          }}
                          width="100%"
                          height={40}
                        />
                      </div>
                    ) : (
                      /* Lista estática cuando solo hay 1 sucursal activa en la empresa */
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ ACCIONES ═══ */}
          <div ref={actionsRef} className={`tdmodal__actions mmdetail__actions tdmodal__actions--${actionsMode}`}>
            <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>

            {puedeActuar && (
              <>
                {/* Eliminar — oculto en multi-sucursal (se gestiona desde SucursalMiembroDetailModal) */}
                {!esMultiSucursal && (
                  <button className="btn btn-orange" onClick={() => setConfirmDelete(true)} disabled={loading}>
                    Eliminar
                  </button>
                )}

                {/* Modificar rol — en multi-sucursal solo el propietario puede subir a empresa */}
                {puedeModificarRol && (
                  <button className="btn btn-indigo" onClick={() => setFormView('modificar-rol')} disabled={loading}>
                    Modificar rol
                  </button>
                )}

                {/* + Sucursal — siempre el último (más a la derecha) */}
                {tipo === 'sucursal' && sucursalesActivas.length > 1 && sucursalesDisponiblesAdd.length > 0 && (
                  <button className="btn btn-green" onClick={() => setFormView('agregar-sucursal')} disabled={loading}>
                    + Sucursal
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de formulario — aparece encima del de detalle ── */}
      {formView && (
        <div className="mmdetail-form-overlay" role="dialog" aria-modal="true" aria-label={formView === 'modificar-rol' ? 'Modificar rol' : 'Agregar a sucursal'}>
          <div className="tdmodal mmdetail mmdetail--form-view" onClick={e => e.stopPropagation()}>
            <div className="tdmodal__handle" />

            {/* Cabecera */}
            <div className="tdmodal__header">
              <h3>{formView === 'modificar-rol' ? 'Modificar rol' : 'Agregar a sucursal'}</h3>
              <button className="btn-icon" onClick={resetForm} aria-label="Cerrar" disabled={loading}>✕</button>
            </div>

            {/* Cuerpo */}
            <div className="tdmodal__body">

              {/* ── Vista: modificar rol ── */}
              {formView === 'modificar-rol' && (
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

                  {necesitaSucursalSelector && (
                    <div className="form-group">
                      <label>Sucursal <span className="mmdetail__req">*</span></label>
                      <CustomSelect
                        options={[
                          { value: '', label: '— Seleccioná una sucursal —' },
                          ...(tipo === 'sucursal' ? miSucursales : sucursales).map(s => ({ value: String(s.id), label: s.nombre ?? `Sucursal ${s.id}` })),
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
              {formView === 'agregar-sucursal' && (
                <div className="mmdetail__form">
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
                </div>
              )}

            </div>

            {/* Acciones */}
            <div ref={formActionsRef} className={`tdmodal__actions mmdetail__actions mmdetail__actions--form tdmodal__actions--${formActionsMode}`}>
              <button className="btn btn-ghost" onClick={resetForm} disabled={loading}>Cancelar</button>
              <button
                className="btn btn-indigo"
                onClick={formView === 'modificar-rol' ? handleModificarRol : handleAgregarSucursal}
                disabled={loading}
              >
                {loading ? <><span className="spinner spinner-sm" /> Guardando…</> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de sucursal específica (multi-sucursal) ── */}
      {selectedSucursalModal && (
        <SucursalMiembroDetailModal
          miembro={miembro}
          sucursal={selectedSucursalModal}
          miRol={miRol}
          onClose={() => setSelectedSucursalModal(null)}
          onUpdated={data => {
            setSelectedSucursalModal(null)
            onUpdated?.(data)
          }}
          onDeleted={() => {
            setSelectedSucursalModal(null)
            onDeleted?.()
          }}
          onError={onError}
        />
      )}

      {/* ConfirmModal eliminar (non-multi) */}
      {confirmDelete && (
        <ConfirmModal
          icon="⚠️"
          message={`¿Deseás eliminar a ${miembro.nombre} ${miembro.apellido} de la empresa?`}
          confirmText="Eliminar"
          confirmVariant="btn-orange"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <ErrorModal
        success={successMsg}
        onClose={() => {
          setSuccessMsg(null)
          resetForm()                           // cierra el form modal
          onUpdated?.(pendingUpdateRef.current)  // actualiza lista; detail modal queda abierto
          pendingUpdateRef.current = null
        }}
      />
    </>
  )
}
