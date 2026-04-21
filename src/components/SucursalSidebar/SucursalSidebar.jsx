import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { ThemeIcon } from '../AppTopBar/AppTopBar'
import logoMiturno from '../../assets/logo-miturno.png'
import './SucursalSidebar.css'

// Secciones de gestión — mismo orden que EmpresaSidebar.
// alwaysLocked: bloqueado para todos los roles en contexto sucursal.
const NAV_ITEMS = [
  { key: 'turnos',              label: 'Turnos',              icon: '📅' },
  { key: 'historial',           label: 'Historial',           icon: '📋' },
  { key: 'miembros',            label: 'Miembros',            icon: '👥', lockedRol: 'EMPLEADO' },
  { key: 'servicios',           label: 'Servicios',           icon: '✂️', lockedRol: 'EMPLEADO' },
  { key: 'clientes',            label: 'Clientes',            icon: '👤' },
  { key: 'clientes-bloqueados', label: 'Clientes Bloqueados', icon: '🚫' },
]

/**
 * Sidebar lateral para páginas de sucursal (GERENTE_SUCURSAL / EMPLEADO).
 *
 * Props:
 *   open       — booleano para mostrar/ocultar
 *   onClose    — callback para cerrar
 *   sucursalId — id de la sucursal activa
 *   miRol      — rol del usuario ('GERENTE_SUCURSAL' | 'EMPLEADO')
 *   activeKey  — key del ítem activo: null = Inicio
 */
export default function SucursalSidebar({ open, onClose, sucursalId, miRol, activeKey }) {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // Cierra el sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) onClose() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])

  const navClick = (e, path, isLocked) => {
    if (isLocked) { e.preventDefault(); return }
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* Overlay oscuro mobile */}
      <div
        className={`hp-sidebar-overlay ${open ? 'hp-sidebar-overlay--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral */}
      <aside className={`hp-sidebar ${open ? 'hp-sidebar--open' : ''}`} aria-label="Navegación sucursal">

        {/* Logo + botón cerrar */}
        <div className="hp-sidebar__head">
          <img
            src={logoMiturno}
            alt="MiTurno"
            className="hp-sidebar__logo"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <button className="hp-sidebar__close" onClick={onClose} aria-label="Cerrar menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Navegación */}
        <nav className="hp-sidebar__nav">

          {/* Inicio — panel principal de sucursal */}
          <a
            href={`#/sucursal/${sucursalId}/panel`}
            className={`hp-sidebar__item ${activeKey === null ? 'hp-sidebar__item--active' : ''}`}
            onClick={(e) => navClick(e, `/sucursal/${sucursalId}/panel`, false)}
          >
            <span className="hp-sidebar__icon">🏠</span>
            Inicio
          </a>

          {NAV_ITEMS.map((item) => {
            const isLocked = item.alwaysLocked || item.lockedRol === miRol
            return (
              <a
                key={item.key}
                href={isLocked ? '#' : `#/sucursal/${sucursalId}/${item.key}`}
                className={`hp-sidebar__item ${activeKey === item.key ? 'hp-sidebar__item--active' : ''} ${isLocked ? 'ss-sidebar__item--locked' : ''}`}
                onClick={(e) => navClick(e, `/sucursal/${sucursalId}/${item.key}`, isLocked)}
                aria-disabled={isLocked}
              >
                <span className="hp-sidebar__icon">{item.icon}</span>
                {item.label}
                {isLocked && <span className="ss-sidebar__lock" aria-label="Sin acceso">🔒</span>}
              </a>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="hp-sidebar__footer">
          <a
            href="#/mis-empresas"
            className="hp-sidebar__item"
            onClick={(e) => navClick(e, '/mis-empresas', false)}
          >
            <span className="hp-sidebar__icon">🏠</span>
            Volver al menú de usuario
          </a>
          <button className="hp-sidebar__item hp-sidebar__theme" onClick={toggleTheme} type="button">
            <ThemeIcon theme={theme} />
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>

      </aside>
    </>
  )
}
