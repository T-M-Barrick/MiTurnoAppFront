import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { geoService } from '../../services/geoService'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import { validateNombre, validateTelefono, scrollToFirstError } from '../../utils/validation'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import DireccionFormItem from '../../components/DireccionFormItem/DireccionFormItem'
import '../CrearEmpresa/CrearEmpresa.css'
import './PerfilesSucursales.css'

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

/** Pre-rellena los campos de formulario a partir de los datos de una sucursal. */
function buildTelefonos(suc) {
  if (suc.telefonos?.length > 0) {
    return suc.telefonos.map((t) => {
      const codigo = extractCodigo(t.numero)
      return { id: t.id, codigo, numero: t.numero.slice(codigo.length) }
    })
  }
  return [{ id: 0, codigo: '+54', numero: '' }]
}

/**
 * Página de perfiles de sucursales para empresa con 2+ sucursales.
 * Permite al propietario/gerente de empresa editar los datos de cada sucursal
 * (nombre, reserva pública, teléfonos, dirección) y, solo para propietarios,
 * activar o desactivar sucursales individualmente.
 */
export default function PerfilesSucursales() {
  const { id: empresaId }                  = useParams()
  const navigate                           = useNavigate()
  const { empresaPanel, setEmpresaPanel }  = useAuth()

  // Sucursales del panel (todas: activas + inactivas), ordenadas por id
  const todasSucursales = [...(empresaPanel?.panel?.sucursales ?? [])].sort((a, b) => a.id - b.id)
  const esPropietario   = empresaPanel?.panel?.rol === 'PROPIETARIO'

  // Sucursal seleccionada actualmente
  const [selectedSucursal, setSelectedSucursal] = useState(null)

  // Campos del formulario de la sucursal seleccionada
  const [nombre,        setNombre]        = useState('')
  const [reservaPublica, setReservaPublica] = useState(true)
  const [telefonos,     setTelefonos]     = useState([{ id: 0, codigo: '+54', numero: '' }])
  const [dirInicial,    setDirInicial]    = useState(null)

  // Datos geo
  const [provincias, setProvincias] = useState([])

  // UI
  const [errors,          setErrors]          = useState({})
  const [loadingInit,     setLoadingInit]     = useState(true)
  const [loading,         setLoading]         = useState(false)
  const [loadingToggle,   setLoadingToggle]   = useState(false)
  const [backError,       setBackError]       = useState(null)
  const [success,         setSuccess]         = useState(null)
  const [confirmAccion,   setConfirmAccion]   = useState(null) // 'activar' | 'desactivar' | null
  const [sidebarOpen,     setSidebarOpen]     = useState(false)

  const dirRef = useRef(null)

  // Carga provincias al montar
  useEffect(() => {
    geoService.getProvincias().then(setProvincias).catch(() => {})
  }, [])

  // Al entrar: GET /empresas/{id}/perfil (router empresa, no sucursal) para datos frescos.
  // Si el panel no está en contexto (acceso directo), también carga el panel para tener el rol.
  useEffect(() => {
    const fetchDatos = async () => {
      setLoadingInit(true)
      try {
        const perfilData = await empresaService.getPerfil(empresaId)

        const panelBase = empresaPanel?.empresaId === String(empresaId)
          ? empresaPanel.panel
          : await empresaService.getPanel(empresaId)

        // Sincroniza las sucursales frescas en el contexto
        setEmpresaPanel(empresaId, { ...panelBase, sucursales: perfilData.sucursales })

        // Selecciona la primera sucursal activa (o la primera en orden)
        const sorted = [...perfilData.sucursales].sort((a, b) => a.id - b.id)
        if (sorted.length > 0) {
          const inicial = sorted.find((s) => s.activa !== false) ?? sorted[0]
          cargarSucursal(inicial)
        }
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingInit(false)
      }
    }
    fetchDatos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Cierra sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /** Actualiza todos los campos del formulario a partir de una sucursal. */
  const cargarSucursal = (suc) => {
    setSelectedSucursal(suc)
    setNombre(suc.nombre ?? '')
    setReservaPublica(suc.reserva_publica_habilitada ?? true)
    setTelefonos(buildTelefonos(suc))
    setDirInicial(suc.direccion ?? null)
    setErrors({})
  }

  const isInactive = selectedSucursal?.activa === false

  // ---- Teléfonos ----
  const addTelefono    = () => setTelefonos((prev) => [...prev, { id: 0, codigo: '+54', numero: '' }])
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

  // ---- Guardar cambios ----
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setBackError(null)

    const payload = {
      nombre:     nombre.trim() || null,
      reserva_publica_habilitada: reservaPublica,
      telefonos: telefonos
        .filter((t) => t.numero.trim())
        .map((t) => ({ id: t.id, numero: t.codigo + t.numero.trim() })),
      direccion: dirRef.current.getData(),
    }

    try {
      const sucRes = await sucursalService.updatePerfil(selectedSucursal.id, payload)

      // Actualiza la sucursal en el panel sin refetch
      if (empresaPanel?.empresaId === String(empresaId)) {
        setEmpresaPanel(empresaId, {
          ...empresaPanel.panel,
          sucursales: empresaPanel.panel.sucursales.map((s) =>
            s.id === sucRes.id ? sucRes : s
          ),
        })
      }
      setSelectedSucursal(sucRes)
      setSuccess('Datos de la sucursal actualizados correctamente.')
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }

  // ---- Activar / Desactivar sucursal ----
  const handleConfirmActivacion = async () => {
    setLoadingToggle(true)
    try {
      if (isInactive) {
        await sucursalService.reactivarSucursal(selectedSucursal.id)
      } else {
        await sucursalService.desactivarSucursal(selectedSucursal.id)
      }

      // Actualiza el campo activa en el panel
      const sucActualizada = { ...selectedSucursal, activa: !isInactive }
      if (empresaPanel?.empresaId === String(empresaId)) {
        setEmpresaPanel(empresaId, {
          ...empresaPanel.panel,
          sucursales: empresaPanel.panel.sucursales.map((s) =>
            s.id === selectedSucursal.id ? sucActualizada : s
          ),
        })
      }
      setSelectedSucursal(sucActualizada)
      setConfirmAccion(null)
    } catch (err) {
      setBackError(err)
      setConfirmAccion(null)
    } finally {
      setLoadingToggle(false)
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

  // Opciones del selector: activas primero, luego inactivas, con indicador visual
  const selectorOptions = todasSucursales.map((s, idx) => ({
    value: String(s.id),
    label: s.nombre?.trim() || `Sucursal ${idx + 1}`,
  }))

  return (
    <div className="ce-page">

      {/* ═══ TOPBAR ═══ */}
      <AppTopBar
        left={backBtn}
        right={<UserTopBarRight empresaId={empresaId} />}
      />

      {/* ═══ TÍTULO — fijo fuera del área scrolleable ═══ */}
      <h1 className="ce-title">🏪 Perfiles de Sucursales</h1>

      {/* Área scrolleable */}
      <div className="ce-scroll">
      <div className="ce-body">

        {/* Spinner de carga inicial */}
        {loadingInit && (
          <div className="svc-loading"><div className="spinner" /></div>
        )}

        {/* ── Selector de sucursal ── */}
        {!loadingInit && (
        <div className="psuc-header">
          <CustomSelect
            options={selectorOptions}
            value={String(selectedSucursal?.id ?? '')}
            onChange={(val) => {
              const found = todasSucursales.find((s) => String(s.id) === val)
              if (found) cargarSucursal(found)
            }}
            width={285}
            height={36}
          />
        </div>
        )}

        {/* ── Toggle activar/desactivar — solo propietario, ancho completo ── */}
        {!loadingInit && esPropietario && selectedSucursal && (
          <div className="ce-toggle-row psuc-toggle-activacion">
            <div className="ce-toggle-info">
              <span className="ce-toggle-label">Sucursal activa</span>
              <span className="ce-toggle-desc">
                {isInactive
                  ? 'La sucursal está desactivada. Los clientes no pueden reservar turnos aquí.'
                  : 'La sucursal está activa y disponible para reservas.'}
              </span>
            </div>
            <button
              type="button"
              className={`psuc-toggle${!isInactive ? ' psuc-toggle--active' : ''}`}
              onClick={() => setConfirmAccion(isInactive ? 'activar' : 'desactivar')}
              disabled={loadingToggle}
              aria-pressed={!isInactive}
              aria-label={isInactive ? 'Reactivar sucursal' : 'Desactivar sucursal'}
            >
              <span className="psuc-toggle__thumb" />
            </button>
          </div>
        )}

        {/* ── Formulario ── */}
        {!loadingInit && <form onSubmit={handleSubmit} noValidate>

          {/* ── Sección 1: Datos de la sucursal ── */}
          <section className="reg-section">
            <h2 className="reg-section__title">
              <span className="reg-section__num">1</span>
              Datos de la sucursal
            </h2>

            <div className="form-group">
              <label htmlFor="ps-nombre">Nombre <span className="reg-required">*</span></label>
              <input
                id="ps-nombre"
                type="text"
                placeholder="Sucursal Centro"
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); clearError('nombre') }}
                className={errors.nombre ? 'error' : ''}
                disabled={loading || isInactive}
              />
              {errors.nombre && <p className="form-error">{errors.nombre}</p>}
            </div>

            {/* Toggle reserva pública — bloqueado si la sucursal está inactiva */}
            <div className="ce-toggle-row">
              <div className="ce-toggle-info">
                <span className="ce-toggle-label">Reserva pública habilitada</span>
                <span className="ce-toggle-desc">Permite que cualquier persona reserve turnos sin invitación.</span>
              </div>
              <button
                type="button"
                className={`ce-toggle${reservaPublica ? ' ce-toggle--on' : ''}`}
                onClick={() => { if (!isInactive) setReservaPublica((v) => !v) }}
                aria-pressed={reservaPublica}
                disabled={loading || isInactive}
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
                      disabled={loading || isInactive}
                    />
                    <input
                      type="tel"
                      placeholder="1112345678"
                      value={tel.numero}
                      onChange={(e) => { updateTelefonoNumero(idx, e.target.value); clearError(`tel_${idx}`) }}
                      className={errors[`tel_${idx}`] ? 'error phone-numero-input' : 'phone-numero-input'}
                      disabled={loading || isInactive}
                      inputMode="numeric"
                    />
                    {telefonos.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-phone"
                        onClick={() => removeTelefono(idx)}
                        aria-label="Eliminar teléfono"
                        disabled={loading || isInactive}
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
              disabled={loading || isInactive}
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
            {/* key fuerza remount al cambiar sucursal para reinicializar dirInicial */}
            <DireccionFormItem
              key={selectedSucursal?.id}
              ref={dirRef}
              initial={dirInicial}
              provincias={provincias}
              index={0}
              canRemove={false}
              showHeader={false}
              disabled={loading || isInactive}
            />
          </section>

          {/* Botón guardar — oculto si la sucursal está inactiva */}
          {!isInactive && (
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

      {/* ═══ MODALES — fuera del área scrolleable ═══ */}

      {/* Confirmación de activar/desactivar sucursal */}
      {confirmAccion && (
        <ConfirmModal
          icon={confirmAccion === 'desactivar' ? '⚠️' : '✅'}
          message={
            confirmAccion === 'desactivar'
              ? `¿Deseás desactivar la sucursal "${selectedSucursal?.nombre ?? 'seleccionada'}"? No se podrá utilizar hasta que la vuelvas a activar.`
              : `¿Deseás reactivar la sucursal "${selectedSucursal?.nombre ?? 'seleccionada'}"?`
          }
          confirmText={confirmAccion === 'desactivar' ? 'Desactivar' : 'Reactivar'}
          confirmVariant={confirmAccion === 'desactivar' ? 'btn-danger' : 'btn-primary'}
          loading={loadingToggle}
          loadingText="Procesando..."
          onConfirm={handleConfirmActivacion}
          onCancel={() => setConfirmAccion(null)}
        />
      )}

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => setSuccess(null)}
      />
    </div>
  )
}
