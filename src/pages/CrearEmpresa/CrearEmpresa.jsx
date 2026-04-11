import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { geoService } from '../../services/geoService'
import { empresaService } from '../../services/empresaService'
import {
  validateEmail, validateCuit, validateNombre,
  validateTelefono, validateTexto, scrollToFirstError
} from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import './CrearEmpresa.css'

export default function CrearEmpresa() {
  const navigate = useNavigate()

  // Botón izquierdo: flecha atrás
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

  // ---- Datos de la empresa ----
  const [nombre, setNombre]       = useState('')
  const [cuit, setCuit]           = useState('')
  const [email, setEmail]         = useState('')
  const [rubro, setRubro]         = useState('')
  const [rubro2, setRubro2]       = useState('')
  const [reservaPublica, setReservaPublica] = useState(true)

  // ---- Teléfonos ----
  const [telefonos, setTelefonos] = useState([{ codigo: '+54', numero: '' }])

  // ---- Datos geo ----
  const [provincias, setProvincias] = useState([])

  // ---- UI ----
  const [errors, setErrors]       = useState({})
  const [loading, setLoading]     = useState(false)
  const [backError, setBackError] = useState(null)
  const [success, setSuccess]     = useState(null)

  // Ref para acceder a datos y validación de la dirección
  const dirRef = useRef(null)

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

  // Carga provincias al montar
  useEffect(() => {
    geoService.getProvincias()
      .then(setProvincias)
      .catch(() => {})
  }, [])

  // ---- Teléfonos ----
  const addTelefono = () => setTelefonos((prev) => [...prev, { codigo: '+54', numero: '' }])
  const removeTelefono = (idx) => setTelefonos((prev) => prev.filter((_, i) => i !== idx))
  const updateTelefonoCodigo = (idx, codigo) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, codigo } : t))
  const updateTelefonoNumero = (idx, numero) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, numero } : t))

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null }))

  // ---- Validación ----
  const validate = () => {
    const e = {}

    const nomErr   = validateNombre(nombre, 'El nombre de la empresa', 40)
    const cuitErr  = validateCuit(cuit)
    const emailErr = validateEmail(email)
    const rubroErr = validateTexto(rubro, 1, 50, 'El rubro')
    const rubro2Err= validateTexto(rubro2, 1, 50, 'El rubro secundario')

    if (nomErr)   e.nombre = nomErr
    if (cuitErr)  e.cuit   = cuitErr
    if (emailErr) e.email  = emailErr
    if (rubroErr) e.rubro  = rubroErr
    if (rubro2Err)e.rubro2 = rubro2Err

    // Teléfonos — solo validar entradas con número escrito (la lista puede estar vacía)
    telefonos.forEach((t, i) => {
      if (!t.numero.trim()) return // entrada vacía: se filtrará al enviar
      const err = validateTelefono(t.codigo + t.numero.trim())
      if (err) e[`tel_${i}`] = err
    })

    setErrors(e)
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
      nombre:   nombre.trim(),
      cuit:     cuit.trim(),
      email:    email.trim().toLowerCase(),
      rubro:    rubro.trim()  || null,
      rubro2:   rubro2.trim() || null,
      reserva_publica_habilitada: reservaPublica,
      telefonos: telefonos
        .filter((t) => t.numero.trim())
        .map((t) => ({ numero: t.codigo + t.numero.trim() })),
      direccion: dirRef.current.getData(),
    }

    try {
      await empresaService.create(payload)
      setSuccess(
        'Empresa creada exitosamente. Te enviamos un email a la casilla de la empresa para verificarla. ' +
        'Confirmala para que tus clientes puedan encontrarla.'
      )
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ce-page">
      {/* Barra superior reutilizable */}
      <AppTopBar left={backBtn} right={<UserTopBarRight />} />

      {/* Título — fijo fuera del área scrolleable */}
      <h1 className="ce-title">🏢 Crear Empresa</h1>

      {/* Área scrolleable: solo el contenido del formulario se desplaza */}
      <div className="ce-scroll">
      <div className="ce-body">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos de la empresa ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos de la empresa
            </h2>

            <div className="form-group">
              <label htmlFor="ce-nombre">Nombre <span className="reg-required">*</span></label>
              <input id="ce-nombre" type="text" placeholder="Mi Empresa S.A."
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''} disabled={loading} />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
            </div>

            <div className="form-row">
              <div className="form-group ce-col-cuit">
                <label htmlFor="ce-cuit">CUIT <span className="reg-hint-inline">(SIN GUIONES NI PUNTOS)</span> <span className="reg-required">*</span></label>
                <input id="ce-cuit" type="text" placeholder="20123456789"
                  value={cuit}
                  onChange={(e) => { setCuit(e.target.value); clearError('cuit') }}
                  className={errors.cuit ? 'error' : ''} disabled={loading}
                  inputMode="numeric" maxLength={11} />
                {errors.cuit && <p className="form-error">{errors.cuit}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="ce-email">Email <span className="reg-required">*</span></label>
                <input id="ce-email" type="email" autoComplete="email"
                  placeholder="contacto@miempresa.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                  className={errors.email ? 'error' : ''} disabled={loading} />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="ce-rubro">Rubro</label>
                <input id="ce-rubro" type="text" placeholder="Ej: Peluquería"
                  value={rubro}
                  onChange={(e) => { setRubro(e.target.value); clearError('rubro') }}
                  className={errors.rubro ? 'error' : ''} disabled={loading} />
                {errors.rubro && <p className="form-error">{errors.rubro}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="ce-rubro2">Rubro secundario</label>
                <input id="ce-rubro2" type="text" placeholder="Ej: Estética"
                  value={rubro2}
                  onChange={(e) => { setRubro2(e.target.value); clearError('rubro2') }}
                  className={errors.rubro2 ? 'error' : ''} disabled={loading} />
                {errors.rubro2 && <p className="form-error">{errors.rubro2}</p>}
              </div>
            </div>

            {/* Toggle: reserva pública habilitada */}
            <div className="ce-toggle-row">
              <div className="ce-toggle-info">
                <span className="ce-toggle-label">Reserva pública habilitada</span>
                <span className="ce-toggle-desc">Permite que cualquier persona reserve turnos sin invitación.</span>
              </div>
              <button
                type="button"
                className={`ce-toggle${reservaPublica ? ' ce-toggle--on' : ''}`}
                onClick={() => setReservaPublica((v) => !v)}
                aria-pressed={reservaPublica}
                disabled={loading}
              >
                <span className="ce-toggle__thumb" />
              </button>
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
                    <CustomSelect
                      options={CODIGOS_PAIS.map((cp) => ({ value: cp.codigo, label: cp.label }))}
                      value={tel.codigo}
                      onChange={(val) => updateTelefonoCodigo(idx, val)}
                      width={200}
                      height={44}
                      disabled={loading}
                    />
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
            <button type="button" className="btn btn-agregar" onClick={addTelefono} disabled={loading}>
              + Agregar teléfono
            </button>
          </section>

          {/* ── Sección 3: Dirección de la sucursal principal ── */}
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
            {loading
              ? <><span className="spinner spinner-sm" /> Creando empresa…</>
              : 'Crear empresa'
            }
          </button>
        </form>
      </div>
      </div>

      {/* Modales — fuera del área scrolleable */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => { setSuccess(null); navigate('/home') }}
      />
    </div>
  )
}
