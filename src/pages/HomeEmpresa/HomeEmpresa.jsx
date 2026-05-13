import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { empresaService } from '../../services/empresaService'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import { getRolLabel } from '../../utils/rolUtils'
import './HomeEmpresa.css'

const STAR_PTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

// Fila de estrellas compacta para el header de empresa
function EmpresaStars({ value }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const pos = i + 1
    if (value >= pos)       return 'full'
    if (value >= pos - 0.5) return 'half'
    return 'empty'
  })
  return (
    <div className="he-stars">
      {stars.map((type, i) => {
        const clipId = `he-star-${i}`
        return (
          <svg key={i} className={`he-star he-star--${type}`} viewBox="0 0 24 24" aria-hidden="true">
            {type === 'half' && (
              <defs>
                <clipPath id={clipId}><rect x="0" y="0" width="12" height="24"/></clipPath>
              </defs>
            )}
            {type === 'empty'
              ? <polygon points={STAR_PTS} fill="none" stroke="currentColor" strokeWidth="1.5"/>
              : type === 'full'
                ? <polygon points={STAR_PTS} fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
                : <>
                    <polygon points={STAR_PTS} fill="none" stroke="currentColor" strokeWidth="1.5"/>
                    <polygon points={STAR_PTS} fill="currentColor" stroke="none" clipPath={`url(#${clipId})`}/>
                  </>
            }
          </svg>
        )
      })}
      <span className="he-stars__num">{value.toFixed(1)}</span>
    </div>
  )
}

// Secciones de gestión: se usan tanto en la sidebar como en el grid de tarjetas
const NAV_CARDS = [
  { key: 'turnos',             label: 'Turnos',             desc: 'Gestioná los turnos de la empresa',          icon: '📅' },
  { key: 'historial',          label: 'Historial',          desc: 'Revisá el historial de turnos pasados',      icon: '📋' },
  { key: 'miembros',           label: 'Miembros',           desc: 'Administrá el equipo y sus roles',           icon: '👥' },
  { key: 'servicios',          label: 'Servicios',          desc: 'Configurá los servicios que ofrecés',        icon: '✂️' },
  { key: 'clientes',           label: 'Clientes',           desc: 'Administrá tu base de clientes y asignación de turnos', icon: '👤' },
  { key: 'clientes-bloqueados', label: 'Clientes Bloqueados', desc: 'Administrá los clientes que bloqueaste',  icon: '🚫' },
]

/**
 * Home de empresa — panel principal con acceso a secciones de gestión.
 */
export default function HomeEmpresa() {
  const { id: empresaId } = useParams()
  const navigate          = useNavigate()
  const location          = useLocation()
  const { user, setEmpresaNotifs, setEmpresaPanel } = useAuth()

  const [empresa,      setEmpresa]      = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [backError,    setBackError]    = useState(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)

  // ---- Modal de logo ----
  const [logoModalOpen,  setLogoModalOpen]  = useState(false)
  const [logoUploading,  setLogoUploading]  = useState(false)
  const [logoError,      setLogoError]      = useState(null)
  const fileInputRef     = useRef(null)

  // ---- Refs para ajuste dinámico de texto ----
  const nombreEmpresaRef = useRef(null)
  const userRef          = useRef(null)
  const rowRef           = useRef(null)
  const [, forceUpdate]  = useState(0)

  // Reajusta el texto al redimensionar la ventana
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Encoge el font-size del nombre de empresa hasta el mínimo; si sigue sin entrar, permite wrapping
  useLayoutEffect(() => {
    const el = nombreEmpresaRef.current
    if (!el) return
    el.style.fontSize  = ''
    el.style.whiteSpace = 'nowrap'
    const base    = parseInt(window.getComputedStyle(el).fontSize, 10) || 22
    const minSize = window.innerWidth < 480 ? 15 : 17
    let size = base
    el.style.fontSize = `${size}px`
    while (el.scrollWidth > el.offsetWidth && size > minSize) {
      size--
      el.style.fontSize = `${size}px`
    }
    if (el.scrollWidth > el.offsetWidth) el.style.whiteSpace = ''
  })

  // Ajusta el nombre del usuario: 1) inline con badge, 2) badge abajo, 3) truncar nombre
  useLayoutEffect(() => {
    const rowEl  = rowRef.current
    const nameEl = userRef.current
    if (!rowEl || !nameEl || !user) return
    const nombres   = (user.nombre   ?? '').trim().split(/\s+/).filter(Boolean)
    const apellidos = (user.apellido ?? '').trim().split(/\s+/).filter(Boolean)
    const build = (ns, as) => [...ns, ...as].join(' ')
    // Resetear a layout inline
    rowEl.style.flexDirection = ''
    rowEl.style.alignItems    = ''
    nameEl.style.width        = ''
    nameEl.textContent        = build(nombres, apellidos)
    // Paso 1: ¿el ancho natural del nombre + gap + badge cabe en el row?
    const badgeEl = rowEl.children.length > 1 ? rowEl.lastElementChild : null
    const totalW  = nameEl.scrollWidth + (badgeEl ? badgeEl.offsetWidth + 10 : 0)
    if (totalW <= rowEl.offsetWidth) return
    // Paso 2: bajar el badge — columna con gap 8px (ya definido en CSS)
    rowEl.style.flexDirection = 'column'
    rowEl.style.alignItems    = 'flex-start'
    nameEl.style.width        = '100%'
    if (nameEl.scrollWidth <= nameEl.offsetWidth) return
    // Paso 3: truncar eliminando palabras (apellido → nombre alternando) hasta 1+1
    let ns   = [...nombres]
    let as   = [...apellidos]
    let turn = 'apellido'
    while (nameEl.scrollWidth > nameEl.offsetWidth && (ns.length + as.length > 2)) {
      if (turn === 'apellido' && as.length > 1) { as = as.slice(0, -1); turn = 'nombre' }
      else if (turn === 'nombre' && ns.length > 1) { ns = ns.slice(0, -1); turn = 'apellido' }
      else if (as.length > 1) { as = as.slice(0, -1) }
      else if (ns.length > 1) { ns = ns.slice(0, -1) }
      else break
      nameEl.textContent = build(ns, as)
    }
  })

  // Carga datos del panel: usa los que vienen del state de navegación (desde MisEmpresas)
  // o fetcha si se accede directamente por URL.
  // En ambos casos guarda las notificaciones del panel en AuthContext para que persistan
  // en todas las páginas secundarias de empresa (Servicios, PerfilEmpresa, etc.).
  useEffect(() => {
    const stateData = location.state?.empresaData
    if (stateData) {
      setEmpresa(stateData)
      setEmpresaNotifs(empresaId, stateData.notificaciones)
      setEmpresaPanel(empresaId, stateData)
      setLoading(false)
      return
    }
    const fetchPanel = async () => {
      setLoading(true)
      try {
        const data = await empresaService.getPanel(empresaId)
        setEmpresa(data)
        setEmpresaNotifs(empresaId, data.notificaciones)
        setEmpresaPanel(empresaId, data)
      } catch (err) {
        setBackError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPanel()
  }, [empresaId])

  // ---- Handlers de logo ----
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    setLogoError(null)
    try {
      const res = await empresaService.uploadLogo(empresaId, file)
      setEmpresa((prev) => ({ ...prev, logo_url: res.logo_url }))
      setLogoModalOpen(false)
    } catch (err) {
      setLogoError(err)
    } finally {
      setLogoUploading(false)
      // Limpia el input para permitir seleccionar el mismo archivo dos veces
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoDelete = async () => {
    setLogoUploading(true)
    setLogoError(null)
    try {
      await empresaService.uploadLogo(empresaId, null) // null = eliminar
      setEmpresa((prev) => ({ ...prev, logo_url: null }))
      setLogoModalOpen(false)
    } catch (err) {
      setLogoError(err)
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div className="he-page">

      {/* ═══ TOPBAR ROJA ═══ */}
      <AppTopBar
        left={
          <button className="hp-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true">
              <rect x="0" y="0"  width="20" height="2" rx="1" fill="white"/>
              <rect x="0" y="6"  width="20" height="2" rx="1" fill="white"/>
              <rect x="0" y="12" width="20" height="2" rx="1" fill="white"/>
            </svg>
          </button>
        }
        right={<UserTopBarRight empresaId={empresaId} empresa={empresa} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        {/* ─── SIDEBAR ─── */}
        <EmpresaSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          empresaId={empresaId}
          activeKey={null}
        />

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main className="hp-main">

          {/* Cabecera: logo (clickable) + nombre empresa + nombre usuario + rol */}
          <div className="he-empresa-header">
            {loading
              ? <div className="he-empresa-loading"><div className="spinner" /></div>
              : <>
                  {/* Logo — botón que abre el modal de gestión */}
                  <button
                    className="he-empresa-logo-btn"
                    onClick={() => setLogoModalOpen(true)}
                    aria-label="Gestionar logo"
                    title="Clic para cambiar o agregar logo"
                  >
                    {empresa?.logo_url
                      ? <img src={empresa.logo_url} alt={empresa.nombre} className="he-empresa-logo"
                          onError={(e) => { e.target.style.display = 'none' }} />
                      : <span className="he-empresa-logo-placeholder">
                          {empresa?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                    }
                  </button>

                  {/* Info: nombre empresa + calificación + nombre usuario + rol */}
                  <div className="he-empresa-info">
                    <span ref={nombreEmpresaRef} className="he-empresa-name">{empresa?.nombre ?? 'Empresa'}</span>
                    {(() => {
                      // Solo muestra calificación si la empresa tiene una única sucursal
                      const sucursales = empresa?.sucursales ?? []
                      if (sucursales.length !== 1) return null
                      const cal = sucursales[0].calificacion
                      if (cal == null) return null
                      const cal5 = Math.round((Number(cal) / 2) * 10) / 10
                      return <EmpresaStars value={cal5} />
                    })()}
                    {user && (
                      <div ref={rowRef} className="he-empresa-user-row">
                        <span ref={userRef} className="he-empresa-user">{user.nombre} {user.apellido}</span>
                        {empresa?.rol && (
                          <span className={`he-empresa-rol he-empresa-rol--${empresa.rol.toLowerCase().replace(/_/g, '-')}`}>
                            {getRolLabel(empresa.rol, empresa.sucursales?.length ?? 0, empresa.rol)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </>
            }
          </div>

          {/* Grid de secciones */}
          <div className="he-grid">
            {NAV_CARDS.map((card) => (
              <a
                key={card.key}
                href={`#/empresa/${empresaId}/${card.key}`}
                className="he-card"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
                  e.preventDefault()
                  navigate(`/empresa/${empresaId}/${card.key}`)
                }}
              >
                <div className={`he-card__icon he-card__icon--${card.key}`}>{card.icon}</div>
                <div className="he-card__info">
                  <span className="he-card__label">{card.label}</span>
                  <span className="he-card__desc">{card.desc}</span>
                </div>
              </a>
            ))}
          </div>

        </main>
      </div>

      {/* ═══ MODAL DE LOGO ═══ */}
      {logoModalOpen && (
        <div className="he-logo-overlay">
          <div className="he-logo-modal" onClick={(e) => e.stopPropagation()}>

            {/* Botón cerrar */}
            <button
              className="he-logo-modal__close"
              onClick={() => setLogoModalOpen(false)}
              disabled={logoUploading}
              aria-label="Cerrar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Vista previa del logo */}
            <div className="he-logo-modal__preview">
              {empresa?.logo_url
                ? <img src={empresa.logo_url} alt={empresa?.nombre} className="he-logo-modal__img" />
                : <span className="he-logo-modal__placeholder">
                    {empresa?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
              }
            </div>

            {/* Nombre de la empresa */}
            <p className="he-logo-modal__name">{empresa?.nombre}</p>

            {/* Acciones */}
            <div className="he-logo-modal__actions">
              {/* Input de archivo oculto */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
                disabled={logoUploading}
              />

              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading
                  ? <><span className="spinner spinner-sm" /> Subiendo…</>
                  : empresa?.logo_url ? 'Cambiar logo' : 'Agregar logo'
                }
              </button>

              {empresa?.logo_url && (
                <button
                  className="btn he-logo-modal__btn-delete"
                  onClick={handleLogoDelete}
                  disabled={logoUploading}
                >
                  Eliminar logo
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {backError  && <ErrorModal error={backError}  onClose={() => setBackError(null)} />}
      {logoError  && <ErrorModal error={logoError}  onClose={() => setLogoError(null)} />}
    </div>
  )
}
