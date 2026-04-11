import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { usuarioService } from '../../services/usuarioService'
import { empresaService } from '../../services/empresaService'
import AppTopBar, { ThemeIcon } from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import logoMiturno from '../../assets/logo-miturno.png'
import './MisEmpresas.css'

const ROL_CLASS = {
  PROPIETARIO:      'me-card__rol--propietario',
  GERENTE_EMPRESA:  'me-card__rol--gerente-empresa',
  GERENTE_SUCURSAL: 'me-card__rol--gerente-sucursal',
  EMPLEADO:         'me-card__rol--empleado',
}

// Etiqueta visible del rol en las tarjetas de mis empresas:
// gerente de empresa siempre "Gerente" (no se sabe si hay más de una sucursal),
// gerente de sucursal siempre "Gerente de Sucursal".
const ROL_LABEL = {
  PROPIETARIO:      'Propietario',
  GERENTE_EMPRESA:  'Gerente',
  GERENTE_SUCURSAL: 'Gerente de Sucursal',
  EMPLEADO:         'Empleado',
}

/* ── Tarjeta individual ── */
function MeCard({ id, nombre, logoUrl, email, rol, isLoading, href, onClick }) {
  const nameRef = useRef(null)

  // Reduce la fuente del nombre hasta que entre en una línea (mín. 11px)
  useLayoutEffect(() => {
    const el = nameRef.current
    if (!el) return
    let size = 17
    el.style.fontSize = `${size}px`
    while (el.scrollWidth > el.offsetWidth && size > 11) {
      size--
      el.style.fontSize = `${size}px`
    }
  })

  // Usa <a> para permitir abrir en nueva pestaña con click derecho / Ctrl+Click
  return (
    <a
      href={href}
      className={`me-card${isLoading ? ' me-card--loading' : ''}`}
      onClick={onClick}
      tabIndex={0}
    >
      <div className="me-card__body">

        {/* Logo o placeholder */}
        <div className="me-card__logo-wrap">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nombre}
              className="me-card__logo"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <span className="me-card__logo-placeholder">
              {nombre?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          )}
        </div>

        {/* Nombre, email, rol */}
        <div className="me-card__info">
          <span ref={nameRef} className="me-card__name">{nombre}</span>
          {email && <span className="me-card__email">📧 {email}</span>}
          {rol   && <span className={`me-card__rol ${ROL_CLASS[rol] ?? ''}`}>{ROL_LABEL[rol] ?? rol}</span>}
        </div>

        {/* Spinner mientras carga */}
        {isLoading && (
          <div className="me-card__spinner">
            <div className="spinner" />
          </div>
        )}

      </div>
    </a>
  )
}

export default function MisEmpresas() {
  const { theme, toggleTheme } = useTheme()
  const navigate               = useNavigate()

  const [empresas,   setEmpresas]   = useState([])
  const [sucursales, setSucursales] = useState([])
  const [loading,    setLoading]    = useState(true)

  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [backError,      setBackError]      = useState(null)
  const [loadingEmpresa, setLoadingEmpresa] = useState(null)

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const data = await usuarioService.getMisEmpresas()
        setEmpresas(data.empresas   ?? [])
        setSucursales(data.sucursales ?? [])
      } catch (err) {
        setBackError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleEmpresaClick = async (e, empresaId) => {
    // Ctrl/Meta/Shift o botón del medio → deja que el browser abra en nueva pestaña
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (loadingEmpresa) return
    setLoadingEmpresa(empresaId)
    try {
      const data = await empresaService.getPanel(empresaId)
      navigate(`/empresa/${empresaId}`, { state: { empresaData: data } })
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingEmpresa(null)
    }
  }

  const hayContenido = empresas.length > 0 || sucursales.length > 0

  return (
    <div className="me-page">

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
        right={<UserTopBarRight />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        {/* Overlay mobile */}
        <div
          className={`hp-sidebar-overlay ${sidebarOpen ? 'hp-sidebar-overlay--open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ─── SIDEBAR ─── */}
        <aside className={`hp-sidebar ${sidebarOpen ? 'hp-sidebar--open' : ''}`} aria-label="Navegación principal">
          <div className="hp-sidebar__head">
            <img src={logoMiturno} alt="MiTurno" className="hp-sidebar__logo" onError={(e) => { e.target.style.display = 'none' }} />
            <button className="hp-sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6"  x2="6"  y2="18"/>
                <line x1="6"  y1="6"  x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <nav className="hp-sidebar__nav">
            <a href="#/home" className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/home') }}>
              <span className="hp-sidebar__icon">🏠</span>Inicio
            </a>
            <button className="hp-sidebar__item hp-sidebar__item--active" onClick={() => setSidebarOpen(false)}>
              <span className="hp-sidebar__icon">🏢</span>Mis Empresas
            </button>
            <a href="#/historial" className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/historial') }}>
              <span className="hp-sidebar__icon">📋</span>Historial
            </a>
            <a href="#/favoritos" className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/favoritos') }}>
              <span className="hp-sidebar__icon">⭐</span>Favoritos
            </a>
          </nav>

          <div className="hp-sidebar__footer">
            <button className="hp-sidebar__item hp-sidebar__theme" onClick={toggleTheme}>
              <ThemeIcon theme={theme} />
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </div>
        </aside>

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main className="hp-main">
          <h1 className="reg-title">🏢 Mis Empresas</h1>
          <div className="me-content">

            {loading && (
              <div className="me-loading"><div className="spinner" /></div>
            )}

            {!loading && !hayContenido && (
              <div className="empty-state">
                <div className="empty-state-icon">🏢</div>
                <h3>Sin empresas</h3>
                <p>No tenés ninguna empresa o sucursal asignada todavía.</p>
              </div>
            )}

            {!loading && hayContenido && (
              <div className="me-grid">

                {/* Empresas propias */}
                {empresas.map((emp) => (
                  <MeCard
                    key={`emp-${emp.empresa_id}`}
                    id={emp.empresa_id}
                    nombre={emp.nombre_empresa}
                    logoUrl={emp.logo_empresa_url}
                    email={emp.email}
                    rol={emp.rol}
                    isLoading={loadingEmpresa === emp.empresa_id}
                    href={`#/empresa/${emp.empresa_id}`}
                    onClick={(e) => handleEmpresaClick(e, emp.empresa_id)}
                  />
                ))}

                {/* Sucursales asignadas */}
                {sucursales.map((suc) => (
                  <MeCard
                    key={`suc-${suc.sucursal_id}`}
                    id={suc.sucursal_id}
                    nombre={suc.nombre_sucursal}
                    logoUrl={suc.logo_empresa_url}
                    email={suc.email}
                    rol={suc.rol}
                    isLoading={false}
                    href={`#/sucursal/${suc.sucursal_id}`}
                    onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(`/sucursal/${suc.sucursal_id}`) }}
                  />
                ))}

              </div>
            )}

          </div>
        </main>
      </div>

      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </div>
  )
}
