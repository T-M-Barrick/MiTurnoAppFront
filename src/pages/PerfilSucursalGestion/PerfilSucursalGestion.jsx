import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { geoService } from '../../services/geoService'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import { validateNombre, validateTelefono, scrollToFirstError } from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import SucursalTopBarRight from '../../components/SucursalTopBarRight/SucursalTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import '../CrearEmpresa/CrearEmpresa.css'
import './PerfilSucursalGestion.css'

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

/** Extrae el código de país de un número completo (con prefijo). */
function extractCodigo(numero) {
  if (!numero) return '+54'
  const sorted = [...CODIGOS_PAIS].sort((a, b) => b.codigo.length - a.codigo.length)
  const found = sorted.find((cp) => numero.startsWith(cp.codigo))
  return found ? found.codigo : '+54'
}

/** Pre-rellena los teléfonos a partir de los datos del perfil. */
function buildTelefonos(perfil) {
  if (perfil.telefonos?.length > 0) {
    return perfil.telefonos.map((t) => {
      const codigo = extractCodigo(t.numero)
      return { id: t.id, codigo, numero: t.numero.slice(codigo.length) }
    })
  }
  return [{ id: 0, codigo: '+54', numero: '' }]
}

/**
 * Perfil de sucursal para GERENTE_SUCURSAL (editable) y EMPLEADO (solo lectura).
 * Idéntico visualmente a PerfilesSucursales, pero sin selector de sucursal
 * ni toggle de activación (solo propietario).
 */
export default function PerfilSucursalGestion() {
  const { id: sucursalId } = useParams()
  const navigate           = useNavigate()
  const { sucursalPanel }  = useAuth()

  const panel      = sucursalPanel?.sucursalId === String(sucursalId) ? sucursalPanel.panel : null
  const miRol      = panel?.rol ?? null
  const isReadOnly = miRol === 'EMPLEADO'
  const entidad    = panel?.cantidad_sucursales === 1 ? 'empresa' : 'sucursal'
  const Entidad    = entidad.charAt(0).toUpperCase() + entidad.slice(1)

  // Campos del formulario
  const [nombre,         setNombre]         = useState('')
  const [reservaPublica, setReservaPublica] = useState(true)
  const [telefonos,      setTelefonos]      = useState([{ id: 0, codigo: '+54', numero: '' }])
  const [dirInicial,     setDirInicial]     = useState(null)

  // Datos geo
  const [provincias, setProvincias] = useState([])

  // UI
  const [errors,      setErrors]      = useState({})
  const [loadingInit, setLoadingInit] = useState(true)
  const [loading,     setLoading]     = useState(false)
  const [backError,   setBackError]   = useState(null)
  const [success,     setSuccess]     = useState(null)

  const dirRef = useRef(null)

  // Carga provincias al montar
  useEffect(() => {
    geoService.getProvincias().then(setProvincias).catch(() => {})
  }, [])

  // Carga perfil de sucursal
  useEffect(() => {
    const fetchPerfil = async () => {
      setLoadingInit(true)
      try {
        const data = await sucursalService.getPerfil(sucursalId)
        setNombre(data.nombre_sucursal ?? '')
        setReservaPublica(data.reserva_publica_habilitada ?? true)
        setTelefonos(buildTelefonos(data))
        setDirInicial(data.direccion ?? null)
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingInit(false)
      }
    }
    fetchPerfil()
  }, [sucursalId])

  // ── Teléfonos ──
  const addTelefono    = () => setTelefonos((prev) => [...prev, { id: 0, codigo: '+54', numero: '' }])
  const removeTelefono = (idx) => setTelefonos((prev) => prev.filter((_, i) => i !== idx))
  const updateTelefonoCodigo = (idx, codigo) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, codigo } : t))
  const updateTelefonoNumero = (idx, numero) =>
    setTelefonos((prev) => prev.map((t, i) => i === idx ? { ...t, numero } : t))

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: null }))

  // ── Validación ──
  const validate = () => {
    const e = {}

    const nomErr = validateNombre(nombre, 'El nombre de la sucursal', 40)
    if (nomErr) e.nombre = nomErr

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

  // ── Guardar cambios ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setBackError(null)

    const payload = {
      nombre: nombre.trim() || null,
      reserva_publica_habilitada: reservaPublica,
      telefonos: telefonos
        .filter((t) => t.numero.trim())
        .map((t) => ({ id: t.id, numero: t.codigo + t.numero.trim() })),
      direccion: dirRef.current.getData(),
    }

    try {
      const data = await sucursalService.updatePerfil(sucursalId, payload)
      setNombre(data.nombre_sucursal ?? '')
      setReservaPublica(data.reserva_publica_habilitada ?? true)
      setTelefonos(buildTelefonos(data))
      setDirInicial(data.direccion ?? null)
      setSuccess(`Datos de la ${entidad} actualizados correctamente.`)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  // Botón de volver al panel de sucursal
  const backBtn = (
    <button
      className="app-topbar__icon-btn"
      onClick={() => navigate(`/sucursal/${sucursalId}/panel`)}
      aria-label="Volver al panel"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  return (
    <div className="ce-page">

      {/* ═══ TOPBAR ═══ */}
      <AppTopBar
        left={backBtn}
        right={<SucursalTopBarRight sucursalId={sucursalId} />}
      />

      {/* ═══ TÍTULO — fijo fuera del área scrolleable ═══ */}
      <h1 className="ce-title">{entidad === 'empresa' ? '🏢' : '🏪'} Perfil de {Entidad}</h1>

      {/* Área scrolleable */}
      <div className="ce-scroll">
      <div className="ce-body">

        {/* Spinner de carga inicial */}
        {loadingInit && (
          <div className="svc-loading"><div className="spinner" /></div>
        )}

        {/* ── Formulario ── */}
        {!loadingInit && <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos de la sucursal ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos de la {entidad}
            </h2>

            <div className="form-group">
              <label htmlFor="psg-nombre">Nombre <span className="reg-required">*</span></label>
              <input
                id="psg-nombre"
                type="text"
                placeholder={entidad === 'empresa' ? 'Mi Empresa' : 'Sucursal Centro'}
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''}
                disabled={loading || isReadOnly}
              />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
            </div>

            {/* Toggle reserva pública */}
            <div className="ce-toggle-row">
              <div className="ce-toggle-info">
                <span className="ce-toggle-label">Reserva pública habilitada</span>
                <span className="ce-toggle-desc">Permite que cualquier persona reserve turnos sin invitación.</span>
              </div>
              <button
                type="button"
                className={`ce-toggle${reservaPublica ? ' ce-toggle--on' : ''}`}
                onClick={() => { if (!isReadOnly) setReservaPublica((v) => !v) }}
                aria-pressed={reservaPublica}
                disabled={loading || isReadOnly}
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
                <div key={tel.id || idx} className="phone-item">
                  <div className="phone-input-row">
                    <CustomSelect
                      options={CODIGOS_PAIS.map((cp) => ({ value: cp.codigo, label: cp.label }))}
                      value={tel.codigo}
                      onChange={(val) => updateTelefonoCodigo(idx, val)}
                      width={200}
                      height={44}
                      disabled={loading || isReadOnly}
                    />
                    <input
                      type="tel"
                      placeholder="1112345678"
                      value={tel.numero}
                      onChange={(e) => { updateTelefonoNumero(idx, e.target.value); clearError(`tel_${idx}`) }}
                      className={errors[`tel_${idx}`] ? 'error phone-numero-input' : 'phone-numero-input'}
                      disabled={loading || isReadOnly}
                      inputMode="numeric"
                    />
                    {telefonos.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-phone"
                        onClick={() => removeTelefono(idx)}
                        aria-label="Eliminar teléfono"
                        disabled={loading || isReadOnly}
                      >✕</button>
                    )}
                  </div>
                  {errors[`tel_${idx}`] && <p className="form-error">{errors[`tel_${idx}`]}</p>}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-agregar"
              onClick={addTelefono}
              disabled={loading || isReadOnly}
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
            {/* key fuerza remount si el sucursalId cambia */}
            <DireccionFormItem
              key={sucursalId}
              ref={dirRef}
              initial={dirInicial}
              provincias={provincias}
              index={0}
              canRemove={false}
              showHeader={false}
              disabled={loading || isReadOnly}
            />
          </section>

          {/* Botón guardar — oculto para EMPLEADO */}
          {!isReadOnly && (
            <button type="submit" className="btn btn-primary reg-submit" disabled={loading}>
              {loading
                ? <><span className="spinner spinner-sm" /> Guardando…</>
                : 'Guardar cambios'
              }
            </button>
          )}
        </form>}

      </div>
      </div>

      {/* ═══ MODALES ═══ */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal success={success} onClose={() => setSuccess(null)} />
    </div>
  )
}
