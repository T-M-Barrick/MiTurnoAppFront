import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import logoMiturno from '../../assets/logo-miturno.png'
import './Sidebar.css'

/**
 * Sidebar lateral que se desliza desde la izquierda.
 *
 * Props:
 *   open    — booleano para mostrar/ocultar
 *   onClose — callback para cerrarlo
 */
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    onClose()
    await logout()
    navigate('/', { replace: true })
  }

  const navTo = (path) => {
    onClose()
    navigate(path)
  }

  return (
    <>
      {/* Overlay oscuro detrás del sidebar */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral */}
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Menú principal">
        {/* Logo + título */}
        <div className="sidebar__header">
          <img src={logoMiturno} alt="MiTurno" className="sidebar__logo-img"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <span className="sidebar__title">MiTurno</span>
        </div>

        {/* Info del usuario */}
        {user && (
          <div className="sidebar__user">
            <div className="sidebar__user-name">{user.nombre} {user.apellido}</div>
            <div className="sidebar__user-email">{user.email}</div>
          </div>
        )}

        {/* Navegación */}
        <nav className="sidebar__nav">
          <button className="sidebar__nav-item" onClick={() => navTo('/home')}>
            <span className="sidebar__nav-icon">🏠</span>
            Mis turnos
          </button>
          <button className="sidebar__nav-item" onClick={() => navTo('/favoritos')}>
            <span className="sidebar__nav-icon">⭐</span>
            Favoritos
          </button>
          <button className="sidebar__nav-item" onClick={() => navTo('/mis-empresas')}>
            <span className="sidebar__nav-icon">🏢</span>
            Mis empresas
          </button>
          <button className="sidebar__nav-item" onClick={() => navTo('/historial')}>
            <span className="sidebar__nav-icon">📋</span>
            Historial
          </button>
        </nav>

        {/* Pie: tema y logout */}
        <div className="sidebar__footer">
          <button className="sidebar__nav-item sidebar__theme-btn" onClick={toggleTheme}>
            <span className="sidebar__nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button className="sidebar__nav-item sidebar__logout" onClick={handleLogout}>
            <span className="sidebar__nav-icon">🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
