import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { geoService } from '../../services/geoService'
import { usuarioService } from '../../services/usuarioService'
import {
  validateDNI, validateNombre, validateTelefono, scrollToFirstError
} from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import '../../components/RecordatorioField/RecordatorioField.css'
import './PerfilUsuario.css'

// Códigos de país disponibles para teléfonos
const CODIGOS_PAIS = [
  { codigo: '+598', label: '🇺🇾 Uruguay (+598)' },
  { codigo: '+595', label: '🇵🇾 Paraguay (+595)' },
  { codigo: '+591', label: '🇧🇴 Bolivia (+591)' },
  { codigo: '+54',  label: '🇦🇷 Argentina (+54)' },
  { codigo: '+55',  label: '🇧🇷 Brasil (+55)' },
  { codigo: '+56',  label: '🇨🇱 Chile (+56)' },
  { codigo: '+57',  label: '🇨🇴 Colombia (+57)' },
  { codigo: '+52',  label: '🇲🇽 México (+52)' },
  { codigo: '+51',  label: '🇵🇪 Perú (+51)' },
  { codigo: '+58',  label: '🇻🇪 Venezuela (+58)' },
  { codigo: '+34',  label: '🇪🇸 España (+34)' },
  { codigo: '+1',   label: '🇺🇸 EE.UU./Canadá (+1)' },
]

/**
 * Extrae el código de país de un número de teléfono completo.
 * Itera desde los códigos más largos a los más cortos para evitar falsos positivos.
 * Retorna '+54' como fallback si no se encuentra ninguno.
 */
function extractCodigo(numero) {
  if (!numero) return '+54'
  const sorted = [...CODIGOS_PAIS].sort((a, b) => b.codigo.length - a.codigo.length)
  const found = sorted.find((cp) => numero.startsWith(cp.codigo))
  return found ? found.codigo : '+54'
}

/**
 * Convierte la lista de teléfonos del back al formato interno del componente.
 * Cada teléfono queda con { id, codigo, numero } donde numero es sin el código de país.
 */
function initTelefonos(tels) {
  if (!tels || tels.length === 0) return [{ id: 0, codigo: '+54', numero: '' }]
  return tels.map((t) => {
    const codigo = extractCodigo(t.numero)
    return {
      id:     t.id,
      codigo,
      numero: t.numero.slice(codigo.length),
    }
  })
}

export default function PerfilUsuario() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  // ---- Datos personales ----
  const [dni, setDni]             = useState(user?.dni       ?? '')
  const [apellido, setApellido]   = useState(user?.apellido  ?? '')
  const [nombre, setNombre]       = useState(user?.nombre    ?? '')
  const [recordatorioEnabled, setRecordatorioEnabled] = useState(!!(user?.recordatorio_minutos_antes))
  const [recordatorioH, setRecordatorioH] = useState(() => {
    const min = user?.recordatorio_minutos_antes
    if (!min) return ''
    return String(Math.floor(min / 60))
  })
  const [recordatorioM, setRecordatorioM] = useState(() => {
    const min = user?.recordatorio_minutos_antes
    if (!min) return '00'
    return (min % 60) >= 30 ? '30' : '00'
  })

  // ---- Teléfonos ----
  const [telefonos, setTelefonos] = useState(() => initTelefonos(user?.telefonos))

  // ---- Direcciones: lista de { key, initial } para controlar desmontaje correcto ----
  const [addrKeys, setAddrKeys] = useState(() =>
    (user?.direcciones ?? []).map((d) => ({ key: d.id, initial: d }))
  )

  // ---- Datos geo del back ----
  const [provincias, setProvincias] = useState([])

  // ---- UI ----
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [backError, setBackError] = useState(null)
  const [success, setSuccess]   = useState(null)

  // Mapa de refs de DireccionFormItem: clave → ref
  const addrRefsMap = useRef({})

  // --- Carga provincias al montar ---
  useEffect(() => {
    geoService.getProvincias()
      .then(setProvincias)
      .catch((err) => setBackError(err))
  }, [])

  // ---- Helpers de teléfonos ----
  const addTelefono = () =>
    setTelefonos((prev) => [...prev, { id: 0, codigo: '+54', numero: '' }])

  const removeTelefono = (idx) =>
    setTelefonos((prev) => prev.filter((_, i) => i !== idx))

  const updateTelefonoCodigo = (idx, codigo) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, codigo } : t))

  const updateTelefonoNumero = (idx, numero) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, numero } : t))

  // ---- Helpers de direcciones ----
  const addDireccion = () =>
    setAddrKeys((prev) => [...prev, { key: Date.now(), initial: null }])

  const removeDireccion = (key) => {
    setAddrKeys((prev) => prev.filter((a) => a.key !== key))
    // Limpia la ref del componente desmontado
    delete addrRefsMap.current[key]
  }

  // ---- Validación ----
  const validate = () => {
    const e = {}

    const dniErr  = validateDNI(dni)
    const apErr   = validateNombre(apellido, 'El apellido')
    const nomErr  = validateNombre(nombre, 'El nombre')

    if (dniErr)  e.dni      = dniErr
    if (apErr)   e.apellido = apErr
    if (nomErr)  e.nombre   = nomErr

    // Recordatorio: validar solo si está habilitado
    if (recordatorioEnabled) {
      const hNum = recordatorioH === '' ? 0 : parseInt(recordatorioH, 10)
      const mNum = recordatorioM === '' ? 0 : parseInt(recordatorioM, 10)
      if (recordatorioH !== '' && (isNaN(hNum) || hNum < 0 || hNum > 23)) {
        e.recordatorio = 'Las horas deben ser entre 0 y 23'
      } else if (recordatorioM !== '' && (isNaN(mNum) || mNum < 0 || mNum > 59)) {
        e.recordatorio = 'Los minutos deben ser entre 0 y 59'
      } else {
        const totalMin = hNum * 60 + mNum
        if (totalMin < 30)   e.recordatorio = 'El mínimo es 30 minutos'
        if (totalMin > 1410) e.recordatorio = 'El máximo es 23 horas 30 minutos'
      }
    }

    // Validar que haya al menos un teléfono con número
    if (telefonos.every((t) => !t.numero.trim())) {
      e.tel_0 = 'Ingresá al menos un teléfono'
    } else {
      // Valida cada teléfono que tenga número ingresado
      telefonos.forEach((t, i) => {
        if (!t.numero.trim()) return // vacíos se omiten salvo si es el único
        const completo = t.codigo + t.numero.trim()
        const err = validateTelefono(completo)
        if (err) e[`tel_${i}`] = err
      })
    }

    // Valida cada dirección a través de su ref
    let allAddrsValid = true
    addrKeys.forEach(({ key }) => {
      const addrRef = addrRefsMap.current[key]
      if (addrRef) {
        const addrOk = addrRef.validate()
        if (!addrOk) allAddrsValid = false
      }
    })

    setErrors(e)
    if (Object.keys(e).length > 0 || !allAddrsValid) scrollToFirstError()
    return Object.keys(e).length === 0 && allAddrsValid
  }

  // ---- Envío del formulario ----
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setBackError(null)

    // Construye el payload con los datos actualizados
    const payload = {
      dni:          dni.trim(),
      apellido:     apellido.trim(),
      nombre:       nombre.trim(),
      recordatorio_minutos_antes: (() => {
        if (!recordatorioEnabled) return null
        const hNum = recordatorioH === '' ? 0 : parseInt(recordatorioH, 10)
        const mNum = recordatorioM === '' ? 0 : parseInt(recordatorioM, 10)
        const total = hNum * 60 + mNum
        return total > 0 ? total : null
      })(),
      telefonos:    telefonos
        .filter((t) => t.numero.trim()) // omite teléfonos vacíos
        .map((t) => ({ id: t.id, numero: t.codigo + t.numero.trim() })),
      direcciones:  addrKeys
        .map(({ key }) => addrRefsMap.current[key]?.getData())
        .filter(Boolean),
    }

    try {
      const updated = await usuarioService.update(payload)
      // Actualiza el usuario en el contexto de autenticación
      updateUser({ ...user, ...updated })
      setSuccess('Tu perfil fue actualizado correctamente.')
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null }))

  // ---- Botones de la barra superior ----
  const backBtn = (
    <button
      className="app-topbar__icon-btn"
      onClick={() => navigate('/home')}
      aria-label="Volver al inicio"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  return (
    <div className="reg-page">
      {/* Barra superior roja reutilizable */}
      <AppTopBar left={backBtn} right={<UserTopBarRight />} />

      {/* Título fijo debajo del topbar */}
      <h1 className="reg-title">👤 Perfil</h1>

      {/* Área scrolleable: solo el formulario */}
      <div className="reg-scroll">
      <div className="reg-body">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos personales ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos personales
            </h2>

            {/* Nombre y Apellido en la misma fila */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="perf-nombre">Nombre <span className="reg-required">*</span></label>
                <input
                  id="perf-nombre"
                  type="text"
                  placeholder="Juan"
                  value={nombre}
                  onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                  className={errors.nombre ? 'error' : ''}
                  disabled={loading}
                />
                {errors.nombre && <p className="form-error">{errors.nombre}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="perf-apellido">Apellido <span className="reg-required">*</span></label>
                <input
                  id="perf-apellido"
                  type="text"
                  placeholder="Pérez"
                  value={apellido}
                  onChange={(e) => { setApellido(e.target.value); clearError('apellido') }}
                  className={errors.apellido ? 'error' : ''}
                  disabled={loading}
                />
                {errors.apellido && <p className="form-error">{errors.apellido}</p>}
              </div>
            </div>

            <div className="form-row">
              {/* DNI */}
              <div className="form-group perf-col-dni">
                <label htmlFor="perf-dni">
                  DNI <span className="reg-hint-inline">(SIN PUNTOS)</span> <span className="reg-required">*</span>
                </label>
                <input
                  id="perf-dni"
                  type="text"
                  placeholder="12345678"
                  value={dni}
                  onChange={(e) => { setDni(e.target.value); clearError('dni') }}
                  className={errors.dni ? 'error' : ''}
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={8}
                />
                {errors.dni && <p className="form-error">{errors.dni}</p>}
              </div>

              {/* Email — solo lectura */}
              <div className="form-group">
                <label htmlFor="perf-email">Email</label>
                <input
                  id="perf-email"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  readOnly
                />
              </div>
            </div>

            {/* Recordatorio de turnos — mismo JSX que RecordatorioField */}
            <div className="perf-rec-group">
              <p className="perf-rec-label">Recordatorio de turnos</p>
              <p className="recfield__desc" style={{ marginBottom: 6 }}>Cuánto tiempo antes del turno recibís el recordatorio</p>
              <div className="recfield">
                <div className="recfield__row">
                  <label className="recfield__toggle">
                    <input
                      type="checkbox"
                      className="recfield__toggle-input"
                      checked={recordatorioEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setRecordatorioEnabled(checked)
                        if (!checked) { setRecordatorioH(''); setRecordatorioM('00') }
                        clearError('recordatorio')
                      }}
                      disabled={loading}
                    />
                    <span className="recfield__toggle-track" />
                  </label>
                  <div className="recfield__field">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="0"
                      className={`recfield__input${errors.recordatorio ? ' recfield__input--error' : ''}`}
                      value={recordatorioH}
                      onChange={(e) => { setRecordatorioH(e.target.value.replace(/\D/g, '').slice(0, 2)); clearError('recordatorio') }}
                      disabled={loading || !recordatorioEnabled}
                    />
                    <span className="recfield__unit">horas</span>
                  </div>
                  <div className="recfield__field">
                    <CustomSelect
                      options={[{ value: '00', label: '00' }, { value: '30', label: '30' }]}
                      value={recordatorioM}
                      onChange={(val) => { setRecordatorioM(val); clearError('recordatorio') }}
                      width={44}
                      height={37}
                      disabled={loading || !recordatorioEnabled}
                      className={errors.recordatorio ? 'recfield__input--error' : ''}
                    />
                    <span className="recfield__unit">minutos</span>
                  </div>

                </div>
                {errors.recordatorio && <p className="recfield__error">{errors.recordatorio}</p>}
              </div>
            </div>
          </section>

          {/* ── Sección 2: Teléfonos ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">2</span>
              Teléfonos
            </h2>
            <div className="phone-list">
              {telefonos.map((tel, idx) => (
                <div key={tel.id || idx} className="phone-item">
                  <div className="phone-input-row">
                    {/* Selector de código de país */}
                    <CustomSelect
                      options={CODIGOS_PAIS.map((cp) => ({ value: cp.codigo, label: cp.label }))}
                      value={tel.codigo}
                      onChange={(val) => updateTelefonoCodigo(idx, val)}
                      width={200}
                      height={44}
                      disabled={loading}
                    />
                    {/* Número sin código */}
                    <input
                      type="tel"
                      placeholder="1112345678"
                      value={tel.numero}
                      onChange={(e) => { updateTelefonoNumero(idx, e.target.value); clearError(`tel_${idx}`) }}
                      className={errors[`tel_${idx}`] ? 'error phone-numero-input' : 'phone-numero-input'}
                      disabled={loading}
                      inputMode="numeric"
                    />
                    {telefonos.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-phone"
                        onClick={() => removeTelefono(idx)}
                        aria-label="Eliminar teléfono"
                        disabled={loading}
                      >✕</button>
                    )}
                  </div>
                  {errors[`tel_${idx}`] && (
                    <p className="form-error">{errors[`tel_${idx}`]}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-agregar"
              onClick={addTelefono}
              disabled={loading}
            >
              + Agregar teléfono
            </button>
          </section>

          {/* ── Sección 3: Direcciones ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">3</span>
              Direcciones
            </h2>

            {/* Lista de ítems de dirección — cada uno expone getData() y validate() */}
            <div className="perf-addr-list">
              {addrKeys.map(({ key, initial: addrInitial }, idx) => (
                <DireccionFormItem
                  key={key}
                  ref={(el) => { addrRefsMap.current[key] = el }}
                  initial={addrInitial}
                  provincias={provincias}
                  index={idx}
                  canRemove={addrKeys.length > 1}
                  onRemove={() => removeDireccion(key)}
                  disabled={loading}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn btn-agregar"
              onClick={addDireccion}
              disabled={loading}
            >
              + Agregar dirección
            </button>
          </section>

          {/* ── Botón enviar ── */}
          <button
            type="submit"
            className="btn btn-primary reg-submit"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner spinner-sm" /> Guardando…</>
              : 'Guardar cambios'
            }
          </button>
        </form>
      </div>
      </div>{/* fin reg-scroll */}

      {/* Modal de error del back */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />

      {/* Modal de éxito — navega de vuelta a /home al cerrar */}
      <ErrorModal
        success={success}
        onClose={() => setSuccess(null)}
      />
    </div>
  )
}
