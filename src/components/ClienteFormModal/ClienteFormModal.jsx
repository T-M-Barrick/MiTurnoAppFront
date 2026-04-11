import { useState } from 'react'
import { sucursalService } from '../../services/sucursalService'
import CustomSelect from '../CustomSelect/CustomSelect'
import ErrorModal from '../ErrorModal/ErrorModal'
import './ClienteFormModal.css'

const CODIGOS_PAIS = [
  { codigo: '+54',  label: '🇦🇷 Argentina (+54)' },
  { codigo: '+55',  label: '🇧🇷 Brasil (+55)' },
  { codigo: '+56',  label: '🇨🇱 Chile (+56)' },
  { codigo: '+57',  label: '🇨🇴 Colombia (+57)' },
  { codigo: '+52',  label: '🇲🇽 México (+52)' },
  { codigo: '+598', label: '🇺🇾 Uruguay (+598)' },
  { codigo: '+595', label: '🇵🇾 Paraguay (+595)' },
  { codigo: '+591', label: '🇧🇴 Bolivia (+591)' },
  { codigo: '+51',  label: '🇵🇪 Perú (+51)' },
  { codigo: '+58',  label: '🇻🇪 Venezuela (+58)' },
  { codigo: '+34',  label: '🇪🇸 España (+34)' },
  { codigo: '+1',   label: '🇺🇸 EE.UU./Canadá (+1)' },
]

// Descompone "+5491112345678" en { codigo: '+54', numero: '91112345678' }
function parseTelefono(full) {
  if (!full) return null
  const sorted = [...CODIGOS_PAIS].sort((a, b) => b.codigo.length - a.codigo.length)
  for (const cp of sorted) {
    if (full.startsWith(cp.codigo)) return { codigo: cp.codigo, numero: full.slice(cp.codigo.length) }
  }
  return { codigo: '+54', numero: full.replace(/^\+/, '') }
}

// Inicializa el array de teléfonos a partir de los datos del cliente
function initTelefonos(cliente) {
  const list = []
  const t1 = parseTelefono(cliente?.telefono)
  const t2 = parseTelefono(cliente?.telefono2)
  if (t1) list.push(t1)
  if (t2) list.push(t2)
  return list
}

/**
 * Modal para crear o modificar un cliente de la sucursal.
 *
 * Props:
 *   sucursalId — id de la sucursal
 *   cliente    — objeto ClienteOut para edición (undefined = modo creación)
 *   onClose    — cerrar el modal
 *   onCreated  — callback(clienteNuevo) tras crear exitosamente
 *   onUpdated  — callback(clienteActualizado) tras modificar exitosamente
 *   onError    — callback(errorObj) para mostrar ErrorModal
 */
export default function ClienteFormModal({ sucursalId, cliente, onClose, onCreated, onUpdated, onError }) {

  const isEdit = !!cliente

  const [clienteActualizado, setClienteActualizado] = useState(null)

  const [dni,         setDni]         = useState(cliente?.dni         ?? '')
  const [apellido,    setApellido]    = useState(cliente?.apellido    ?? '')
  const [nombre,      setNombre]      = useState(cliente?.nombre      ?? '')
  const [email,       setEmail]       = useState(cliente?.email       ?? '')
  const [telefonos,   setTelefonos]   = useState(() => { const l = initTelefonos(cliente); return l.length ? l : [{ codigo: '+54', numero: '' }] })
  const [observacion, setObservacion] = useState(cliente?.observacion ?? '')
  const [errors,      setErrors]      = useState({})
  const [loading,     setLoading]     = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState(null) // cliente recién creado, para mostrar éxito

  // Helpers de teléfonos
  const addTelefono    = () => setTelefonos(prev => [...prev, { codigo: '+54', numero: '' }])
  const removeTelefono = (idx) => setTelefonos(prev => prev.filter((_, i) => i !== idx))
  const updateCodigo   = (idx, codigo) => setTelefonos(prev => prev.map((t, i) => i === idx ? { ...t, codigo } : t))
  const updateNumero   = (idx, numero) => {
    setTelefonos(prev => prev.map((t, i) => i === idx ? { ...t, numero } : t))
    clearError(`tel_${idx}`)
  }

  // Valida replicando las reglas Pydantic del back
  const validate = () => {
    const e = {}

    if (!dni.trim())
      e.dni = 'El DNI es obligatorio'
    else if (!/^[0-9]{6,8}$/.test(dni.trim()))
      e.dni = 'El DNI debe contener entre 6 y 8 dígitos numéricos'

    if (!apellido.trim())
      e.apellido = 'El apellido es obligatorio'
    else if (apellido.trim().length > 30)
      e.apellido = 'El apellido no puede superar los 30 caracteres'

    if (!nombre.trim())
      e.nombre = 'El nombre es obligatorio'
    else if (nombre.trim().length > 40)
      e.nombre = 'El nombre no puede superar los 40 caracteres'

    if (!email.trim())
      e.email = 'El email es obligatorio'
    else if (email.length > 255)
      e.email = 'El email no puede superar los 255 caracteres'
    else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim()))
      e.email = 'El email no tiene un formato válido'

    telefonos.forEach((t, idx) => {
      if (t.numero.trim()) {
        const completo = t.codigo + t.numero.trim()
        if (!/^\+[1-9][0-9]{5,28}$/.test(completo))
          e[`tel_${idx}`] = 'Número inválido. Ej: 1112345678'
      }
    })

    if (observacion.trim() && observacion.trim().length > 500)
      e.observacion = 'La observación no puede superar los 500 caracteres'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    // Construye los valores de telefono y telefono2 desde el array
    const tel1 = telefonos[0]?.numero.trim() ? telefonos[0].codigo + telefonos[0].numero.trim() : null
    const tel2 = telefonos[1]?.numero.trim() ? telefonos[1].codigo + telefonos[1].numero.trim() : null

    setLoading(true)
    try {
      if (isEdit) {
        const payload = {}
        if (dni.trim()         !== (cliente.dni         ?? '')) payload.dni         = dni.trim()
        if (apellido.trim()    !== (cliente.apellido    ?? '')) payload.apellido    = apellido.trim()
        if (nombre.trim()      !== (cliente.nombre      ?? '')) payload.nombre      = nombre.trim()
        if (email.trim()       !== (cliente.email       ?? '')) payload.email       = email.trim()
        if (tel1 !== (cliente.telefono    ?? null)) payload.telefono    = tel1
        if (tel2 !== (cliente.telefono2   ?? null)) payload.telefono2   = tel2
        const obs = observacion.trim() || null
        if (obs !== (cliente.observacion ?? null)) payload.observacion = obs

        if (Object.keys(payload).length === 0) { onClose?.(); return }
        const actualizado = await sucursalService.updateCliente(sucursalId, cliente.id, payload)
        setClienteActualizado(actualizado)
      } else {
        const payload = {
          dni:       dni.trim(),
          apellido:  apellido.trim(),
          nombre:    nombre.trim(),
          email:     email.trim(),
          telefono:  tel1,   // siempre presente, null si vacío
          telefono2: tel2,   // siempre presente, null si vacío
          observacion: observacion.trim() || null,
        }
        const nuevo = await sucursalService.createCliente(sucursalId, payload)
        setNuevoCliente(nuevo)
      }
    } catch (err) {
      onError?.(err)
    } finally {
      setLoading(false)
    }
  }

  const clearError = (field) => setErrors(prev => ({ ...prev, [field]: null }))

  return (
    <div className="tdmodal-overlay">
      <div className="tdmodal cfmodal" onClick={(e) => e.stopPropagation()}>
        <div className="tdmodal__handle" />

        {/* ═══ CABECERA ═══ */}
        <div className="tdmodal__header">
          <h3>{isEdit ? 'Modificar cliente' : 'Nuevo cliente'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar" disabled={loading}>✕</button>
        </div>

        {/* ═══ FORMULARIO ═══ */}
        <form className="tdmodal__body cfmodal__body" onSubmit={handleSubmit} noValidate>

          {/* Nombre + Apellido en fila */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cf-nombre">Nombre <span className="cfmodal__req">*</span></label>
              <input
                id="cf-nombre"
                type="text"
                placeholder="Juan"
                maxLength={40}
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''}
                disabled={loading}
              />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="cf-apellido">Apellido <span className="cfmodal__req">*</span></label>
              <input
                id="cf-apellido"
                type="text"
                placeholder="García"
                maxLength={30}
                value={apellido}
                onChange={(e) => { setApellido(e.target.value); clearError('apellido') }}
                className={errors.apellido ? 'error' : ''}
                disabled={loading}
              />
              {errors.apellido && <p className="form-error">{errors.apellido}</p>}
            </div>
          </div>

          {/* DNI + Email en fila */}
          <div className="form-row">
            <div className="form-group cfmodal__col-dni">
              <label htmlFor="cf-dni">DNI <span className="cfmodal__hint">(SIN PUNTOS)</span> <span className="cfmodal__req">*</span></label>
              <input
                id="cf-dni"
                type="text"
                inputMode="numeric"
                placeholder="12345678"
                maxLength={8}
                value={dni}
                onChange={(e) => { setDni(e.target.value); clearError('dni') }}
                className={errors.dni ? 'error' : ''}
                disabled={loading}
              />
              {errors.dni && <p className="form-error">{errors.dni}</p>}
            </div>
            <div className="form-group cfmodal__col-email">
              <label htmlFor="cf-email">Email <span className="cfmodal__req">*</span></label>
              <input
                id="cf-email"
                type="email"
                placeholder="juan@ejemplo.com"
                maxLength={255}
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                className={errors.email ? 'error' : ''}
                disabled={loading}
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
          </div>

          {/* Teléfonos con selector de código de país */}
          <div className="form-group">
            <label>Teléfonos</label>
            <div className="cfmodal__phone-list">
              {telefonos.map((tel, idx) => (
                <div key={idx} className="cfmodal__phone-item">
                  <div className="cfmodal__phone-row">
                    <CustomSelect
                      options={CODIGOS_PAIS.map(cp => ({ value: cp.codigo, label: cp.label }))}
                      value={tel.codigo}
                      onChange={(val) => updateCodigo(idx, val)}
                      width={184}
                      height={44}
                      disabled={loading}
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="1112345678"
                      value={tel.numero}
                      onChange={(e) => updateNumero(idx, e.target.value)}
                      className={`cfmodal__phone-numero${errors[`tel_${idx}`] ? ' error' : ''}`}
                      disabled={loading}
                    />
                    {telefonos.length > 1 && (
                      <button
                        type="button"
                        className="cfmodal__phone-remove"
                        onClick={() => removeTelefono(idx)}
                        aria-label="Eliminar teléfono"
                        disabled={loading}
                      >✕</button>
                    )}
                  </div>
                  {errors[`tel_${idx}`] && <p className="form-error">{errors[`tel_${idx}`]}</p>}
                </div>
              ))}
            </div>
            {telefonos.length < 2 && (
              <button
                type="button"
                className="cfmodal__phone-add"
                onClick={addTelefono}
                disabled={loading}
              >+ Agregar teléfono</button>
            )}
          </div>

          {/* Observación */}
          <div className="form-group">
            <label htmlFor="cf-obs">Observación</label>
            <textarea
              id="cf-obs"
              placeholder="Notas sobre el cliente..."
              maxLength={500}
              rows={3}
              value={observacion}
              onChange={(e) => { setObservacion(e.target.value); clearError('observacion') }}
              className={errors.observacion ? 'error' : ''}
              disabled={loading}
            />
            {errors.observacion && <p className="form-error">{errors.observacion}</p>}
          </div>

        </form>

        {/* ═══ FOOTER CON BOTONES ═══ */}
        <div className="tdmodal__actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className={`btn ${isEdit ? 'btn-indigo' : 'btn-primary'} cfmodal__btn-guardar`}
            onClick={handleSubmit}
            disabled={loading}
            type="button"
          >
            {loading ? <><span className="spinner spinner-sm" /> Guardando…</> : isEdit ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ═══ MODAL: éxito al crear cliente ═══ */}
      {nuevoCliente && (
        <ErrorModal
          success="Cliente creado correctamente."
          onClose={() => onCreated?.(nuevoCliente)}
        />
      )}

      {/* ═══ MODAL: éxito al modificar cliente — al cerrarlo también cierra este modal ═══ */}
      {clienteActualizado && (
        <ErrorModal
          success="Cliente modificado correctamente."
          onClose={() => onUpdated?.(clienteActualizado)}
        />
      )}
    </div>
  )
}
