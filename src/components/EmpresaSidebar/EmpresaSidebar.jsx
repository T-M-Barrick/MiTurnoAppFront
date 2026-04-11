import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { ThemeIcon } from '../AppTopBar/AppTopBar'
import logoMiturno from '../../assets/logo-miturno.png'
import './EmpresaSidebar.css'

// Secciones de gestión de la empresa
const NAV_ITEMS = [
  { key: 'turnos',             label: 'Turnos',             icon: '📅' },
  { key: 'historial',          label: 'Historial',          icon: '📋' },
  { key: 'miembros',           label: 'Miembros',           icon: '👥' },
  { key: 'servicios',          label: 'Servicios',          icon: '✂️' },
  { key: 'clientes',           label: 'Clientes',           icon: '👤' },
  { key: 'clientes-bloqueados', label: 'Clientes Bloqueados', icon: '🚫' },
]

/**
 * Sidebar lateral reutilizable para todas las páginas de empresa.
 *
 * Props:
 *   open      — booleano para mostrar/ocultar
 *   onClose   — callback para cerrar
 *   empresaId — id de la empresa activa
 *   activeKey — key del ítem activo: null = Inicio, o alguna key de NAV_ITEMS
 */
export default function EmpresaSidebar({ open, onClose, empresaId, activeKey }) {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  // Cierra el sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) onClose() }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [onClose])

  // Permite SPA navigation en click izquierdo y apertura en nueva pestaña con Ctrl/click derecho
  const navClick = (e, path) => {
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
      <aside className={`hp-sidebar ${open ? 'hp-sidebar--open' : ''}`} aria-label="Navegación empresa">

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

          {/* Inicio — panel principal de empresa */}
          <a
            href={`#/empresa/${empresaId}`}
            className={`hp-sidebar__item ${activeKey === null ? 'hp-sidebar__item--active' : ''}`}
            onClick={(e) => navClick(e, `/empresa/${empresaId}`)}
          >
            <span className="hp-sidebar__icon">🏠</span>
            Inicio
          </a>

          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              href={`#/empresa/${empresaId}/${item.key}`}
              className={`hp-sidebar__item ${activeKey === item.key ? 'hp-sidebar__item--active' : ''}`}
              onClick={(e) => navClick(e, `/empresa/${empresaId}/${item.key}`)}
            >
              <span className="hp-sidebar__icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="hp-sidebar__footer">
          <a
            href="#/mis-empresas"
            className="hp-sidebar__item"
            onClick={(e) => navClick(e, '/mis-empresas')}
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
