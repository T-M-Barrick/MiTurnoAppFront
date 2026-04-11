import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { geoService } from '../../services/geoService'
import { usuarioService } from '../../services/usuarioService'
import {
  validateEmail, validatePassword, validateDNI,
  validateNombre, validateTelefono, scrollToFirstError
} from '../../utils/validation'
import AppTopBar, { ThemeIcon } from '../../components/AppTopBar/AppTopBar'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import '../../components/RecordatorioField/RecordatorioField.css'
import './Registro.css'

export default function Registro() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // Botón izquierdo: flecha atrás (SVG para centrado consistente entre navegadores)
  const backBtn = (
    <Link to="/" className="app-topbar__icon-btn reg-back" aria-label="Volver al login">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>
  )

  // Botón derecho: toggle tema
  const themeBtn = (
    <button className="app-topbar__icon-btn" onClick={toggleTheme} aria-label="Cambiar tema">
      <ThemeIcon theme={theme} />
    </button>
  )

  // ---- Datos personales ----
  const [dni, setDni]             = useState('')
  const [apellido, setApellido]   = useState('')
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [recordatorioEnabled, setRecordatorioEnabled] = useState(false)
  const [recordatorioH, setRecordatorioH] = useState('') // horas
  const [recordatorioM, setRecordatorioM] = useState('00') // minutos: "00" o "30"

  // ---- Teléfonos ----
  // codigo: código de país seleccionado, numero: número sin código
  const [telefonos, setTelefonos] = useState([{ codigo: '+54', numero: '' }])

  // ---- Datos geo del back ----
  const [provincias, setProvincias] = useState([])

  // ---- UI ----
  const [errors, setErrors]       = useState({})
  const [loading, setLoading]     = useState(false)
  const [backError, setBackError] = useState(null)
  const [success, setSuccess]     = useState(null)

  // Ref para acceder a datos y validación de la dirección
  const dirRef = useRef(null)

  // Carga provincias al montar
  useEffect(() => {
    geoService.getProvincias()
      .then(setProvincias)
      .catch(() => {})
  }, [])

  // ---- Teléfonos ----
  const CODIGOS_PAIS = [
    { codigo: '+54', label: '🇦🇷 Argentina (+54)' },
    { codigo: '+55', label: '🇧🇷 Brasil (+55)' },
    { codigo: '+56', label: '🇨🇱 Chile (+56)' },
    { codigo: '+57', label: '🇨🇴 Colombia (+57)' },
    { codigo: '+52', label: '🇲🇽 México (+52)' },
    { codigo: '+598', label: '🇺🇾 Uruguay (+598)' },
    { codigo: '+595', label: '🇵🇾 Paraguay (+595)' },
    { codigo: '+591', label: '🇧🇴 Bolivia (+591)' },
    { codigo: '+51', label: '🇵🇪 Perú (+51)' },
    { codigo: '+58', label: '🇻🇪 Venezuela (+58)' },
    { codigo: '+34', label: '🇪🇸 España (+34)' },
    { codigo: '+1',  label: '🇺🇸 EE.UU./Canadá (+1)' },
  ]

  const addTelefono = () => setTelefonos((prev) => [...prev, { codigo: '+54', numero: '' }])
  const removeTelefono = (idx) => setTelefonos((prev) => prev.filter((_, i) => i !== idx))
  const updateTelefonoCodigo = (idx, codigo) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, codigo } : t))
  const updateTelefonoNumero = (idx, numero) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, numero } : t))

  // ---- Validación ----
  const validate = () => {
    const e = {}

    const dniErr     = validateDNI(dni)
    const apErr      = validateNombre(apellido, 'El apellido')
    const nomErr     = validateNombre(nombre, 'El nombre')
    const emailErr   = validateEmail(email)
    const passErr    = validatePassword(password)
    if (dniErr)   e.dni      = dniErr
    if (apErr)    e.apellido = apErr
    if (nomErr)   e.nombre   = nomErr
    if (emailErr) e.email    = emailErr
    if (passErr)  e.password = passErr
    if (password !== confirmPass) e.confirmPass = 'Las contraseñas no coinciden'

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

    // Teléfonos — valida el número combinado (código + número)
    telefonos.forEach((t, i) => {
      const completo = t.codigo + t.numero.trim()
      const err = validateTelefono(completo)
      if (err) e[`tel_${i}`] = err
    })

    setErrors(e)
    // Valida la dirección por separado (muestra sus propios errores inline)
    const dirValid = dirRef.current?.validate() ?? false
    if (Object.keys(e).length > 0 || !dirValid) { scrollToFirstError(); return false }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setBackError(null)

    const payload = {
      dni:      dni.trim(),
      apellido: apellido.trim(),
      nombre:   nombre.trim(),
      email:    email.trim().toLowerCase(),
      password: password,
      recordatorio_minutos_antes: (() => {
        if (!recordatorioEnabled) return null
        const hNum = recordatorioH === '' ? 0 : parseInt(recordatorioH, 10)
        const mNum = recordatorioM === '' ? 0 : parseInt(recordatorioM, 10)
        const total = hNum * 60 + mNum
        return total > 0 ? total : null
      })(),
      telefonos: telefonos.map((t) => ({ numero: t.codigo + t.numero.trim() })),
      direcciones: [dirRef.current.getData()],
    }

    try {
      await usuarioService.register(payload)
      setSuccess(
        'Cuenta creada exitosamente. Te enviamos un email para verificar tu cuenta. ' +
        'Confirmala para poder ingresar. ' +
        'Si no lo recibís en unos minutos, revisá tu carpeta de spam.'
      )
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null }))

  return (
    <div className="reg-page">
      {/* Barra superior reutilizable */}
      <AppTopBar left={backBtn} right={themeBtn} />

      {/* Título de la página — fijo fuera del área scrolleable */}
      <h1 className="reg-title">👤 Crear Cuenta</h1>

      {/* Área scrolleable: solo el contenido del formulario se desplaza */}
      <div className="reg-scroll">
      <div className="reg-body">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos personales ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos personales
            </h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="reg-nombre">Nombre <span className="reg-required">*</span></label>
                <input id="reg-nombre" type="text" placeholder="Juan"
                  value={nombre} onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                  className={errors.nombre ? 'error' : ''} disabled={loading} />
                {errors.nombre && <p className="form-error">{errors.nombre}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="reg-apellido">Apellido <span className="reg-required">*</span></label>
                <input id="reg-apellido" type="text" placeholder="Pérez"
                  value={apellido} onChange={(e) => { setApellido(e.target.value); clearError('apellido') }}
                  className={errors.apellido ? 'error' : ''} disabled={loading} />
                {errors.apellido && <p className="form-error">{errors.apellido}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group reg-col-dni">
                <label htmlFor="reg-dni">DNI <span className="reg-hint-inline">(SIN PUNTOS)</span> <span className="reg-required">*</span></label>
                <input id="reg-dni" type="text" placeholder="12345678"
                  value={dni} onChange={(e) => { setDni(e.target.value); clearError('dni') }}
                  className={errors.dni ? 'error' : ''} disabled={loading}
                  inputMode="numeric" maxLength={8} />
                {errors.dni && <p className="form-error">{errors.dni}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email <span className="reg-required">*</span></label>
                <input id="reg-email" type="email" autoComplete="email"
                  placeholder="juan@ejemplo.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                  className={errors.email ? 'error' : ''} disabled={loading} />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
            </div>

            {/* Recordatorio de turnos */}
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

            <div className="form-group">
              <label htmlFor="reg-pass">Contraseña <span className="reg-required">*</span></label>
              <div className="password-wrapper">
                <input id="reg-pass" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres, letras y números"
                  value={password} onChange={(e) => { setPassword(e.target.value); clearError('password') }}
                  className={errors.password ? 'error' : ''} disabled={loading} />
                <button type="button" className="eye-btn" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label="Mostrar contraseña">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="reg-confirm">Repetir contraseña <span className="reg-required">*</span></label>
              <div className="password-wrapper">
                <input id="reg-confirm" type={showConfirmPass ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  value={confirmPass} onChange={(e) => { setConfirmPass(e.target.value); clearError('confirmPass') }}
                  className={errors.confirmPass ? 'error' : ''} disabled={loading} />
                <button type="button" className="eye-btn" onClick={() => setShowConfirmPass((v) => !v)} tabIndex={-1} aria-label="Mostrar contraseña">
                  {showConfirmPass ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirmPass && <p className="form-error">{errors.confirmPass}</p>}
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
                <div key={idx} className="phone-item">
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

          {/* ── Sección 3: Dirección ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">3</span>
              Dirección
            </h2>
            <DireccionFormItem
              ref={dirRef}
              initial={null}
              provincias={provincias}
              index={0}
              canRemove={false}
              showHeader={false}
              disabled={loading}
            />
          </section>

          {/* ── Botón enviar ── */}
          <button type="submit" className="btn btn-primary reg-submit" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm" /> Creando cuenta…</> : 'Crear cuenta'}
          </button>
        </form>
      </div>
      </div>

      {/* Modales — fuera del área scrolleable */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => { setSuccess(null); navigate('/') }}
      />
    </div>
  )
}
