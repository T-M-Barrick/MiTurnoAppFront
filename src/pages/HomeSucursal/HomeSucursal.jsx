import { useState, useEffect } from 'react'
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
                    <span className="he-empresa-name">
                      {panel?.nombre_empresa
                        ? `${panel.nombre_empresa} - ${panel.nombre_sucursal ?? 'Sucursal 1'}`
                        : panel?.nombre_sucursal ?? 'Sucursal 1'}
                    </span>
                    {user && (
                      <div className="he-empresa-user-row">
                        <span className="he-empresa-user">{user.nombre} {user.apellido}</span>
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
