import { useState } from 'react'
import { invitacionesService } from '../../services/invitacionesService'
import CustomSelect from '../CustomSelect/CustomSelect'
import ErrorModal from '../ErrorModal/ErrorModal'
import '../ClienteFormModal/ClienteFormModal.css'
import './InvitarMiembroModal.css'

// Roles disponibles según el rango del usuario que invita y la cantidad de sucursales.
// Cuando la empresa tiene una sola sucursal, GERENTE_SUCURSAL no existe como concepto
// independiente: se muestra "Gerente" que el back almacena como GERENTE_EMPRESA.
const ROLES_PROPIETARIO_MULTI = [
  { value: 'PROPIETARIO',      label: 'Propietario' },
  { value: 'GERENTE_EMPRESA',  label: 'Gerente de empresa' },
  { value: 'GERENTE_SUCURSAL', label: 'Gerente de sucursal' },
  { value: 'EMPLEADO',         label: 'Empleado' },
]
const ROLES_PROPIETARIO_SINGLE = [
  { value: 'PROPIETARIO',      label: 'Propietario' },
  { value: 'GERENTE_EMPRESA',  label: 'Gerente' },
  { value: 'EMPLEADO',         label: 'Empleado' },
]
const ROLES_GERENTE_EMPRESA_MULTI = [
  { value: 'GERENTE_SUCURSAL', label: 'Gerente de sucursal' },
  { value: 'EMPLEADO',         label: 'Empleado' },
]
const ROLES_GERENTE_EMPRESA_SINGLE = [
  { value: 'EMPLEADO',         label: 'Empleado' },
]
// GERENTE_SUCURSAL solo puede invitar empleados a su propia sucursal
const ROLES_GERENTE_SUCURSAL = [
  { value: 'EMPLEADO',         label: 'Empleado' },
]

// Roles que requieren asignar una sucursal específica
const ROLES_SUCURSAL = ['GERENTE_SUCURSAL', 'EMPLEADO']

/**
 * Modal para invitar a un usuario como miembro de la empresa o una sucursal.
 *
 * Props:
 *   empresaId  — id de la empresa
 *   sucursales — lista de sucursales de la empresa
 *   miRol      — rol del usuario que invita ('PROPIETARIO' | 'GERENTE_EMPRESA')
 *   onClose    — cierra el modal
 *   onInvited  — callback al invitar exitosamente
 *   onError    — callback(errorObj) para ErrorModal
 */
export default function InvitarMiembroModal({ empresaId, sucursales, miRol, onClose, onInvited, onError }) {
  const [email,      setEmail]      = useState('')
  const [rol,        setRol]        = useState('')
  const [sucursalId, setSucursalId] = useState('')
  const [errors,     setErrors]     = useState({})
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)

  const esSucursalUnica  = sucursales.length === 1
  const rolesDisponibles = miRol === 'PROPIETARIO'
    ? (esSucursalUnica ? ROLES_PROPIETARIO_SINGLE  : ROLES_PROPIETARIO_MULTI)
    : miRol === 'GERENTE_SUCURSAL'
      ? ROLES_GERENTE_SUCURSAL
      : (esSucursalUnica ? ROLES_GERENTE_EMPRESA_SINGLE : ROLES_GERENTE_EMPRESA_MULTI)
  const esBranchRol      = ROLES_SUCURSAL.includes(rol)

  const clearError = (field) => setErrors(prev => ({ ...prev, [field]: null }))

  const validate = () => {
    const e = {}
    if (!email.trim())
      e.email = 'El email es obligatorio'
    else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim()))
      e.email = 'El email no tiene un formato válido'
    if (!rol)
      e.rol = 'El rol es obligatorio'
    if (esBranchRol && sucursales.length > 1 && !sucursalId)
      e.sucursal = 'Seleccioná una sucursal'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        usuario_email: email.trim(),
        rol,
        empresa_id: Number(empresaId),
      }
      // Si es rol de sucursal y hay más de una, usa la seleccionada; si hay una sola, usa esa
      if (esBranchRol) {
        payload.sucursal_id = sucursales.length === 1
          ? sucursales[0].id
          : Number(sucursalId)
      }
      await invitacionesService.invitar(payload)
      setSuccess(true)
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal cfmodal immodal" onClick={e => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA ═══ */}
        <div className="tdmodal__header">
          <h3>Invitar miembro</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar" disabled={loading}>✕</button>
        </div>

        {/* ═══ FORMULARIO ═══ */}
        <div className="tdmodal__body cfmodal__body immodal__body">

          {/* Email */}
          <div className="form-group">
            <label htmlFor="im-email">Email <span className="cfmodal__req">*</span></label>
            <input
              id="im-email"
              type="email"
              placeholder="usuario@ejemplo.com"
              maxLength={255}
              value={email}
              onChange={e => { setEmail(e.target.value); clearError('email') }}
              className={errors.email ? 'error' : ''}
              disabled={loading}
            />
            {errors.email && <p className="form-error">{errors.email}</p>}
          </div>

          {/* Rol */}
          <div className="form-group">
            <label>Rol <span className="cfmodal__req">*</span></label>
            <CustomSelect
              options={[{ value: '', label: '— Seleccioná un rol —' }, ...rolesDisponibles]}
              value={rol}
              onChange={val => { setRol(val); setSucursalId(''); clearError('rol') }}
              width="100%"
              height={44}
              disabled={loading}
              className={errors.rol ? 'error' : ''}
            />
            {errors.rol && <p className="form-error">{errors.rol}</p>}
          </div>

          {/* Sucursal (solo si es rol de sucursal y hay más de una) */}
          {esBranchRol && sucursales.length > 1 && (
            <div className="form-group">
              <label>Sucursal <span className="cfmodal__req">*</span></label>
              <CustomSelect
                options={[
                  { value: '', label: '— Seleccioná una sucursal —' },
                  ...sucursales.map(s => ({ value: String(s.id), label: s.nombre ?? `Sucursal ${s.id}` })),
                ]}
                value={sucursalId}
                onChange={val => { setSucursalId(val); clearError('sucursal') }}
                width="100%"
                height={44}
                disabled={loading}
                className={errors.sucursal ? 'error' : ''}
              />
              {errors.sucursal && <p className="form-error">{errors.sucursal}</p>}
            </div>
          )}

        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="tdmodal__actions cfmodal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Enviando…</> : 'Enviar invitación'}
          </button>
        </div>

      </div>

      {success && (
        <ErrorModal
          success="Invitación enviada correctamente."
          onClose={() => { setSuccess(false); onInvited?.() }}
        />
      )}
    </div>
  )
}
