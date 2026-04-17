import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { geoService } from '../../services/geoService'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import {
  validateCuit, validateNombre, validateTelefono, validateTexto, scrollToFirstError
} from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import './PerfilEmpresa.css'

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

export default function PerfilEmpresa() {
  const { id: empresaId }              = useParams()
  const navigate                       = useNavigate()
  const { empresaPanel, setEmpresaPanel } = useAuth()

  // Modo multi-sucursal: 2+ sucursales activas → solo se editan datos de empresa aquí
  const sucursalesPanel = empresaPanel?.panel?.sucursales ?? []
  const modoMulti       = sucursalesPanel.length >= 2

  // ---- Datos de la empresa ----
  const [nombre, setNombre]         = useState('')
  const [cuit, setCuit]             = useState('')
  const [email, setEmail]           = useState('') // solo lectura
  const [rubro, setRubro]           = useState('')
  const [rubro2, setRubro2]         = useState('')
  const [reservaPublica, setReservaPublica] = useState(true)

  // ---- Sucursal (ids para el PATCH) ----
  const [sucursalId, setSucursalId] = useState(null)

  // ---- Teléfonos: { id, codigo, numero } ----
  const [telefonos, setTelefonos] = useState([{ id: 0, codigo: '+54', numero: '' }])

  // ---- Dirección inicial (para pasar a DireccionFormItem una vez cargada) ----
  const [dirInicial, setDirInicial] = useState(null)

  // ---- Datos geo ----
  const [provincias, setProvincias] = useState([])

  // ---- UI ----
  const [errors, setErrors]               = useState({})
  const [loading, setLoading]             = useState(false)
  const [loadingPerfil, setLoadingPerfil] = useState(true)
  const [backError, setBackError]         = useState(null)
  const [success, setSuccess]             = useState(null)

  // Ref para acceder a datos y validación de la dirección
  const dirRef = useRef(null)

  // Carga provincias al montar
  useEffect(() => {
    geoService.getProvincias().then(setProvincias).catch((err) => setBackError(err))
  }, [])

  // Si el panel no está en contexto (acceso directo por URL), lo fetcha para que
  // UserTopBarRight y modoMulti tengan los datos correctos desde el inicio.
  useEffect(() => {
    if (empresaPanel?.empresaId === String(empresaId)) return
    empresaService.getPanel(empresaId)
      .then((data) => setEmpresaPanel(empresaId, data))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Carga el perfil y pre-rellena todos los campos
  useEffect(() => {
    const fetchPerfil = async () => {
      setLoadingPerfil(true)
      try {
        const data = await empresaService.getPerfil(empresaId)

        // Datos de empresa
        setNombre(data.nombre ?? '')
        setCuit(data.cuit ?? '')
        setEmail(data.email ?? '')
        setRubro(data.rubro ?? '')
        setRubro2(data.rubro2 ?? '')

        // Sucursal principal — en modo single siempre hay 1 activa; se toma la activa
        const suc = (data.sucursales ?? []).find((s) => s.activa !== false) ?? data.sucursales?.[0]
        if (suc && !modoMulti) {
          setSucursalId(suc.id)
          setReservaPublica(suc.reserva_publica_habilitada ?? true)

          // Teléfonos
          if (suc.telefonos?.length > 0) {
            setTelefonos(suc.telefonos.map((t) => {
              const codigo = extractCodigo(t.numero)
              return { id: t.id, codigo, numero: t.numero.slice(codigo.length) }
            }))
          }

          // Dirección — se pasa como initial a DireccionFormItem
          if (suc.direccion) setDirInicial(suc.direccion)
        }
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingPerfil(false)
      }
    }
    fetchPerfil()
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps


  // ---- Teléfonos ----
  const addTelefono = () => setTelefonos((prev) => [...prev, { id: 0, codigo: '+54', numero: '' }])
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
    const rubroErr = validateTexto(rubro, 1, 50, 'El rubro')
    const rubro2Err= validateTexto(rubro2, 1, 50, 'El rubro secundario')

    if (nomErr)    e.nombre = nomErr
    if (cuitErr)   e.cuit   = cuitErr
    if (rubroErr)  e.rubro  = rubroErr
    if (rubro2Err) e.rubro2 = rubro2Err

    // Telefonos y dirección solo se validan en modo single (1 sucursal activa)
    if (!modoMulti) {
      telefonos.forEach((t, i) => {
        if (!t.numero.trim()) return
        const err = validateTelefono(t.codigo + t.numero.trim())
        if (err) e[`tel_${i}`] = err
      })
    }

    setErrors(e)
    const dirValid = modoMulti ? true : (dirRef.current?.validate() ?? false)
    if (Object.keys(e).length > 0 || !dirValid) { scrollToFirstError(); return false }
    return true
  }

  // ---- Envío ----
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setBackError(null)

    const empresaPayload = {
      nombre:  nombre.trim(),
      cuit:    cuit.trim(),
      rubro:   rubro.trim()  || null,
      rubro2:  rubro2.trim() || null,
    }

    try {
      if (modoMulti) {
        // Modo multi: solo se actualiza la empresa (sucursales se editan en PerfilesSucursales)
        const empRes = await empresaService.update(empresaId, empresaPayload)
        if (empresaPanel?.empresaId === String(empresaId)) {
          setEmpresaPanel(empresaId, { ...empresaPanel.panel, nombre: empRes.nombre })
        }
      } else {
        // Modo single: actualiza empresa + sucursal en paralelo
        const sucPayload = {
          reserva_publica_habilitada: reservaPublica,
          telefonos: telefonos
            .filter((t) => t.numero.trim())
            .map((t) => ({ id: t.id, numero: t.codigo + t.numero.trim() })),
          direccion: dirRef.current.getData(),
        }
        const [empRes, sucRes] = await Promise.all([
          empresaService.update(empresaId, empresaPayload),
          sucursalService.updatePerfil(sucursalId, sucPayload),
        ])
        if (empresaPanel?.empresaId === String(empresaId)) {
          setEmpresaPanel(empresaId, {
            ...empresaPanel.panel,
            nombre: empRes.nombre,
            sucursales: empresaPanel.panel.sucursales.map((s) =>
              s.id === sucRes.id ? sucRes : s
            ),
          })
        }
      }

      setSuccess('Los datos de la empresa fueron actualizados correctamente.')
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  // Botón de volver al panel de empresa
  const backBtn = (
    <button
      className="app-topbar__icon-btn"
      onClick={() => navigate(`/empresa/${empresaId}`)}
      aria-label="Volver al panel"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  if (loadingPerfil) {
    return (
      <div className="ce-page">
        <AppTopBar
          left={backBtn}
          right={<UserTopBarRight empresaId={empresaId} />}
        />
        <div className="loading-inline" style={{ marginTop: 60 }}><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="ce-page">

      {/* ═══ TOPBAR ═══ */}
      <AppTopBar
        left={backBtn}
        right={<UserTopBarRight empresaId={empresaId} />}
      />

      {/* ═══ TÍTULO — fijo fuera del área scrolleable ═══ */}
      <h1 className="ce-title">🏢 Perfil de Empresa</h1>

      {/* Área scrolleable: solo el contenido del formulario se desplaza */}
      <div className="ce-scroll">
      <div className="ce-body">
        <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos de la empresa ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              {!modoMulti && <span className="reg-section__num">1</span>}
              Datos de la empresa
            </h2>

            <div className="form-group">
              <label htmlFor="pe-nombre">Nombre <span className="reg-required">*</span></label>
              <input id="pe-nombre" type="text" placeholder="Mi Empresa S.A."
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''} disabled={loading} />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
            </div>

            <div className="form-row">
              <div className="form-group ce-col-cuit">
                <label htmlFor="pe-cuit">CUIT <span className="reg-hint-inline">(SIN GUIONES NI PUNTOS)</span> <span className="reg-required">*</span></label>
                <input id="pe-cuit" type="text" placeholder="20123456789"
                  value={cuit}
                  onChange={(e) => { setCuit(e.target.value); clearError('cuit') }}
                  className={errors.cuit ? 'error' : ''} disabled={loading}
                  inputMode="numeric" maxLength={11} />
                {errors.cuit && <p className="form-error">{errors.cuit}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="pe-email">Email</label>
                <input id="pe-email" type="email" value={email} disabled readOnly />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="pe-rubro">Rubro</label>
                <input id="pe-rubro" type="text" placeholder="Ej: Peluquería"
                  value={rubro}
                  onChange={(e) => { setRubro(e.target.value); clearError('rubro') }}
                  className={errors.rubro ? 'error' : ''} disabled={loading} />
                {errors.rubro && <p className="form-error">{errors.rubro}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="pe-rubro2">Rubro secundario</label>
                <input id="pe-rubro2" type="text" placeholder="Ej: Estética"
                  value={rubro2}
                  onChange={(e) => { setRubro2(e.target.value); clearError('rubro2') }}
                  className={errors.rubro2 ? 'error' : ''} disabled={loading} />
                {errors.rubro2 && <p className="form-error">{errors.rubro2}</p>}
              </div>
            </div>

            {/* Toggle: reserva pública habilitada — solo en modo single */}
            {!modoMulti && (
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
            )}
          </section>

          {/* ── Sección 2: Teléfonos — solo en modo single ── */}
          {!modoMulti && (
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
                        <button type="button" className="btn-remove-phone"
                          onClick={() => removeTelefono(idx)} aria-label="Eliminar teléfono" disabled={loading}>
                          ✕
                        </button>
                      )}
                    </div>
                    {errors[`tel_${idx}`] && <p className="form-error">{errors[`tel_${idx}`]}</p>}
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-agregar" onClick={addTelefono} disabled={loading}>
                + Agregar teléfono
              </button>
            </section>
          )}

          {/* ── Sección 3: Dirección — solo en modo single ── */}
          {!modoMulti && (
            <section className="reg-section">
              <h2 className="reg-section__title">
                <span className="reg-section__num">3</span>
                Dirección
              </h2>
              <DireccionFormItem
                ref={dirRef}
                initial={dirInicial}
                provincias={provincias}
                index={0}
                canRemove={false}
                showHeader={false}
                disabled={loading}
              />
            </section>
          )}

          {/* ── Botón enviar ── */}
          <button type="submit" className="btn btn-primary reg-submit" disabled={loading}>
            {loading
              ? <><span className="spinner spinner-sm" /> Guardando…</>
              : 'Guardar cambios'
            }
          </button>
        </form>
      </div>
      </div>

      {/* ═══ MODALES — fuera del área scrolleable ═══ */}
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => setSuccess(null)}
      />
    </div>
  )
}
