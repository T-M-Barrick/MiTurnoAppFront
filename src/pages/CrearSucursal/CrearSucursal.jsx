import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { geoService } from '../../services/geoService'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import {
  validateNombre, validateTelefono, scrollToFirstError
} from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import '../CrearEmpresa/CrearEmpresa.css'

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

export default function CrearSucursal() {
  const { id: empresaId } = useParams()
  const navigate = useNavigate()
  const { empresaPanel, setEmpresaPanel } = useAuth()

  // Botón izquierdo: flecha atrás al home de empresa
  const backBtn = (
    <button
      className="app-topbar__icon-btn"
      onClick={() => navigate(`/empresa/${empresaId}`)}
      aria-label="Volver al inicio de empresa"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  // ---- Datos de la sucursal ----
  const [nombre,        setNombre]        = useState('')
  const [reservaPublica, setReservaPublica] = useState(true)

  // ---- Teléfonos ----
  const [telefonos, setTelefonos] = useState([{ codigo: '+54', numero: '' }])

  // ---- Datos geo ----
  const [provincias, setProvincias] = useState([])

  // ---- UI ----
  const [errors,    setErrors]    = useState({})
  const [loading,   setLoading]   = useState(false)
  const [backError, setBackError] = useState(null)
  const [success,   setSuccess]   = useState(null)

  // Ref para acceder a datos y validación de la dirección
  const dirRef = useRef(null)

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

    const nomErr = validateNombre(nombre, 'El nombre de la sucursal', 40)
    if (nomErr) e.nombre = nomErr

    // Teléfonos — solo validar entradas con número escrito
    telefonos.forEach((t, i) => {
      if (!t.numero.trim()) return
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
      empresa_id: Number(empresaId),
      nombre:     nombre.trim(),
      reserva_publica_habilitada: reservaPublica,
      telefonos: telefonos
        .filter((t) => t.numero.trim())
        .map((t) => ({ numero: t.codigo + t.numero.trim() })),
      direccion: dirRef.current.getData(),
    }

    try {
      const nuevaSucursal = await sucursalService.createSucursal(payload)

      // Agrega la sucursal al panel compartido de AuthContext sin necesidad de refetch
      if (empresaPanel?.empresaId === String(empresaId)) {
        setEmpresaPanel(empresaId, {
          ...empresaPanel.panel,
          sucursales: [...empresaPanel.panel.sucursales, nuevaSucursal],
        })
      }

      setSuccess('¡Sucursal creada exitosamente!')
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ce-page">
      {/* Barra superior reutilizable */}
      <AppTopBar left={backBtn} right={<UserTopBarRight empresaId={empresaId} />} />

      {/* Título — fijo fuera del área scrolleable */}
      <h1 className="ce-title">🏗️ Crear Sucursal</h1>

      {/* Área scrolleable: solo el contenido del formulario se desplaza */}
      <div className="ce-scroll">
      <div className="ce-body">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos de la sucursal ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos de la sucursal
            </h2>

            <div className="form-group">
              <label htmlFor="cs-nombre">Nombre <span className="reg-required">*</span></label>
              <input id="cs-nombre" type="text" placeholder="Sucursal Centro"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''} disabled={loading} />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
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
            {loading
              ? <><span className="spinner spinner-sm" /> Creando sucursal…</>
              : 'Crear sucursal'
            }
          </button>
        </form>
      </div>
      </div>

      {/* Modales — fuera del área scrolleable */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => { setSuccess(null); navigate(`/empresa/${empresaId}`) }}
      />
    </div>
  )
}
