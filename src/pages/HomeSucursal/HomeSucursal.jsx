import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sucursalService } from '../../services/sucursalService'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import SucursalTopBarRight from '../../components/SucursalTopBarRight/SucursalTopBarRight'
import SucursalSidebar from '../../components/SucursalSidebar/SucursalSidebar'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import './HomeSucursal.css'

// Tarjetas de navegación — mismo orden que HomeEmpresa.
// lockedRol: rol bloqueado. alwaysLocked: siempre bloqueado (sin ruta en contexto sucursal).
const NAV_CARDS = [
  { key: 'turnos',              label: 'Turnos',              desc: (e) => `Gestioná los turnos de la ${e}`,         icon: '📅' },
  { key: 'historial',           label: 'Historial',           desc: 'Revisá el historial de turnos pasados',         icon: '📋' },
  { key: 'miembros',            label: 'Miembros',            desc: 'Administrá el equipo y sus roles',           icon: '👥', lockedRol: 'EMPLEADO' },
  { key: 'servicios',           label: 'Servicios',           desc: 'Configurá los servicios que ofrecés',           icon: '✂️', lockedRol: 'EMPLEADO' },
  { key: 'clientes',            label: 'Clientes',            desc: 'Administrá tu base de clientes y asignación de turnos', icon: '👤' },
  { key: 'clientes-bloqueados', label: 'Clientes Bloqueados', desc: 'Administrá los clientes que bloqueaste',        icon: '🚫' },
]

const ROL_LABEL = {
  GERENTE_SUCURSAL: 'Gerente de Sucursal',
  EMPLEADO:         'Empleado',
}

/**
 * Home de sucursal para GERENTE_SUCURSAL y EMPLEADO.
 * Carga el panel de sucursal desde el back y guarda los datos en AuthContext.
 */
export default function HomeSucursal() {
  const { id: sucursalId } = useParams()
  const navigate           = useNavigate()
  const { user, setSucursalPanel, setSucursalNotifs } = useAuth()

  const [panel,       setPanel]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [backError,   setBackError]   = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // Encoge el font-size del nombre hasta el mínimo; si sigue sin entrar, permite wrapping
  useLayoutEffect(() => {
    const el = nombreEmpresaRef.current
    if (!el) return
    el.style.fontSize   = ''
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

  // Cierra sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carga el panel de sucursal al montar (siempre fetchea para tener datos frescos)
  useEffect(() => {
    const fetchPanel = async () => {
      setLoading(true)
      try {
        const data = await sucursalService.getSucursalPanel(sucursalId)
        setPanel(data)
        setSucursalPanel(sucursalId, data)
        setSucursalNotifs(sucursalId, data.notificaciones)
      } catch (err) {
        setBackError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPanel()
  }, [sucursalId]) // eslint-disable-line react-hooks/exhaustive-deps

  const miRol   = panel?.rol ?? null
  const entidad = panel?.cantidad_sucursales === 1 ? 'empresa' : 'sucursal'

  return (
    <div className="hs-page">

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
        right={<SucursalTopBarRight sucursalId={sucursalId} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        {/* ─── SIDEBAR ─── */}
        <SucursalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sucursalId={sucursalId}
          miRol={miRol}
          activeKey={null}
        />

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main className="hp-main">

          {/* Cabecera: logo + nombre sucursal + empresa + usuario + rol */}
          <div className="he-empresa-header">
            {loading
              ? <div className="he-empresa-loading"><div className="spinner" /></div>
              : <>
                  {/* Logo (solo visual, sin edición) */}
                  <div className="hs-logo-wrap">
                    {panel?.logo_url
                      ? <img src={panel.logo_url} alt={panel.nombre_empresa} className="he-empresa-logo"
                          onError={(e) => { e.target.style.display = 'none' }} />
                      : <span className="he-empresa-logo-placeholder">
                          {panel?.nombre_sucursal?.charAt(0)?.toUpperCase()
                            ?? panel?.nombre_empresa?.charAt(0)?.toUpperCase()
                            ?? '?'}
                        </span>
                    }
                  </div>

                  {/* Info */}
                  <div className="he-empresa-info">
                    <span ref={nombreEmpresaRef} className="he-empresa-name">
                      {panel?.nombre_empresa
                        ? `${panel.nombre_empresa} - ${panel.nombre_sucursal ?? 'Sucursal 1'}`
                        : panel?.nombre_sucursal ?? 'Sucursal 1'}
                    </span>
                    {user && (
                      <div ref={rowRef} className="he-empresa-user-row">
                        <span ref={userRef} className="he-empresa-user">{user.nombre} {user.apellido}</span>
                        {miRol && (
                          <span className={`he-empresa-rol he-empresa-rol--${miRol.toLowerCase().replace(/_/g, '-')}`}>
                            {ROL_LABEL[miRol] ?? miRol}
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
            {NAV_CARDS.map((card) => {
              const isLocked = card.alwaysLocked || card.lockedRol === miRol
              return (
                <a
                  key={card.key}
                  href={isLocked ? '#' : `#/sucursal/${sucursalId}/${card.key}`}
                  className={`he-card ${isLocked ? 'hs-card--locked' : ''}`}
                  onClick={(e) => {
                    if (isLocked) { e.preventDefault(); return }
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
                    e.preventDefault()
                    navigate(`/sucursal/${sucursalId}/${card.key}`)
                  }}
                  aria-disabled={isLocked}
                >
                  <div className={`he-card__icon he-card__icon--${card.key}`}>
                    {isLocked ? '🔒' : card.icon}
                  </div>
                  <div className="he-card__info">
                    <span className="he-card__label">{card.label}</span>
                    <span className="he-card__desc">
                      {isLocked ? 'No tenés acceso a esta sección' : (typeof card.desc === 'function' ? card.desc(entidad) : card.desc)}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>

        </main>
      </div>

      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </div>
  )
}
