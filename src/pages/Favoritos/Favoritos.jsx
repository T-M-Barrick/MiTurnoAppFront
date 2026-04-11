import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import AppTopBar, { ThemeIcon } from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaCard from '../../components/EmpresaCard/EmpresaCard'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import { usuarioService } from '../../services/usuarioService'
import logoMiturno from '../../assets/logo-miturno.png'
import './Favoritos.css'

export default function Favoritos() {
  const { user, updateUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [removingIds, setRemovingIds] = useState(new Set())
  const [error, setError]             = useState(null)

  const favoritos = (user?.favoritos ?? []).filter(f => !removingIds.has(f.id))

  // Elimina de favoritos de forma optimista (sin modal de confirmación)
  const handleRemoveFavorito = async (sucursalId) => {
    setRemovingIds(prev => new Set([...prev, sucursalId]))

    try {
      await usuarioService.deleteFavorito(sucursalId)
      updateUser({
        favoritos: (user?.favoritos ?? []).filter(f => f.id !== sucursalId),
      })
    } catch (err) {
      setRemovingIds(prev => {
        const next = new Set(prev)
        next.delete(sucursalId)
        return next
      })
      setError(err?.response?.data?.detail ?? 'No se pudo quitar de favoritos.')
    }
  }

  const handleCardClick = (e, sucursal) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(`/sucursal/${sucursal.id}`, { state: { sucursal } })
  }

  const navTo = (e, path) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setSidebarOpen(false)
    navigate(path)
  }

  return (
    <div className="fav-page">
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

      {/* Overlay mobile */}
      <div
        className={`hp-sidebar-overlay ${sidebarOpen ? 'hp-sidebar-overlay--open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`hp-sidebar ${sidebarOpen ? 'hp-sidebar--open' : ''}`} aria-label="Navegación principal">
        <div className="hp-sidebar__head">
          <img
            src={logoMiturno}
            alt="MiTurno"
            className="hp-sidebar__logo"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <button className="hp-sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <nav className="hp-sidebar__nav">
          <a href="#/home" className="hp-sidebar__item" onClick={(e) => navTo(e, '/home')}>
            <span className="hp-sidebar__icon">🏠</span>
            Inicio
          </a>
          <a href="#/mis-empresas" className="hp-sidebar__item" onClick={(e) => navTo(e, '/mis-empresas')}>
            <span className="hp-sidebar__icon">🏢</span>
            Mis Empresas
          </a>
          <a href="#/historial" className="hp-sidebar__item" onClick={(e) => navTo(e, '/historial')}>
            <span className="hp-sidebar__icon">📋</span>
            Historial
          </a>
          <button className="hp-sidebar__item hp-sidebar__item--active" onClick={() => setSidebarOpen(false)}>
            <span className="hp-sidebar__icon">⭐</span>
            Favoritos
          </button>
        </nav>

        <div className="hp-sidebar__footer">
          <button className="hp-sidebar__item hp-sidebar__theme" onClick={toggleTheme}>
            <ThemeIcon theme={theme} />
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="fav-body">
        <div className="fav-center">
          <h1 className="fav-title">⭐ Favoritos</h1>

          {favoritos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⭐</div>
              <h3>Sin favoritos</h3>
              <p>Agregá empresas desde el buscador para verlas acá.</p>
            </div>
          ) : (
            <div className="fav-grid">
              {favoritos.map(suc => (
                <EmpresaCard
                  key={suc.id}
                  sucursal={suc}
                  isFavorito={true}
                  onToggleFavorito={handleRemoveFavorito}
                  href={`#/sucursal/${suc.id}`}
                  onClick={(e) => handleCardClick(e, suc)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {error && <ErrorModal message={error} onClose={() => setError(null)} />}
    </div>
  )
}
