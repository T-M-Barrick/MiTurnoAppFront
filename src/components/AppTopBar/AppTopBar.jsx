import { useTheme } from '../../context/ThemeContext'
import logoMiturno from '../../assets/logo-miturno.png'
import './AppTopBar.css'

/**
 * Barra superior roja reutilizable.
 *
 * Props:
 *   left  — nodo React para la columna izquierda (ej: hamburger, flecha atrás)
 *   right — nodo React para la columna derecha (ej: campana + avatar, toggle tema)
 *           Si no se pasa right, muestra el toggle de tema por defecto.
 */
export default function AppTopBar({ left = null, right }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="app-topbar">
      {/* Columna izquierda */}
      <div className="app-topbar__left">
        {left}
      </div>

      {/* Logo centrado */}
      <div className="app-topbar__brand">
        <img
          src={logoMiturno}
          alt="MiTurno"
          className="app-topbar__logo"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      </div>

      {/* Columna derecha */}
      <div className="app-topbar__right">
        {right !== undefined ? right : (
          <button className="app-topbar__icon-btn" onClick={toggleTheme} aria-label="Cambiar tema">
            <ThemeIcon theme={theme} />
          </button>
        )}
      </div>
    </header>
  )
}

/** Ícono sol/luna — igual al de la página de login */
export function ThemeIcon({ theme }) {
  return (
    <span style={{ fontSize: 18, lineHeight: 1 }}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </span>
  )
}
