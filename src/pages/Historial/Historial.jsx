import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { usuarioService } from '../../services/usuarioService'
import AppTopBar, { ThemeIcon } from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import TurnoCard from '../../components/TurnoCard/TurnoCard'
import TurnoDetailModal from '../../components/TurnoDetailModal/TurnoDetailModal'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import logoMiturno from '../../assets/logo-miturno.png'
import './Historial.css'

export default function Historial() {
  const { theme, toggleTheme } = useTheme()
  const navigate               = useNavigate()

  const [historial,    setHistorial]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [cursor,       setCursor]       = useState(null) // { fecha_hora, id } | null
  const [hayMas,       setHayMas]       = useState(false)

  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [selectedTurno, setSelectedTurno] = useState(null)
  const [backError,    setBackError]    = useState(null)

  // Cierra sidebar en desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carga inicial del historial
  useEffect(() => {
    const fetchHistorial = async () => {
      setLoading(true)
      try {
        const data = await usuarioService.getHistorial()
        setHistorial(data.historial ?? [])
        setCursor(
          data.ultimo_cursor_id
            ? { fecha_hora: data.ultimo_cursor_fecha_hora, id: data.ultimo_cursor_id }
            : null
        )
        setHayMas(!!data.ultimo_cursor_id)
      } catch (err) {
        setBackError(err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistorial()
  }, [])

  // Carga más entradas usando el cursor
  const handleCargarMas = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await usuarioService.getHistorial({
        fechaHoraUltima: cursor.fecha_hora,
        idUltimo:        cursor.id,
      })
      setHistorial((prev) => [...prev, ...(data.historial ?? [])])
      setCursor(
        data.ultimo_cursor_id
          ? { fecha_hora: data.ultimo_cursor_fecha_hora, id: data.ultimo_cursor_id }
          : null
      )
      setHayMas(!!data.ultimo_cursor_id)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Elimina un turno del historial (tras borrar desde el modal)
  const handleDeleted = (turnoId) => {
    setHistorial((prev) => prev.filter((t) => t.id !== turnoId))
    setSelectedTurno(null)
  }

  return (
    <div className="hist-page">

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
            <a href="#/mis-empresas" className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/mis-empresas') }}>
              <span className="hp-sidebar__icon">🏢</span>Mis Empresas
            </a>
            <button className="hp-sidebar__item hp-sidebar__item--active" onClick={() => setSidebarOpen(false)}>
              <span className="hp-sidebar__icon">📋</span>Historial
            </button>
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

          {/* Título de sección */}
          <h1 className="reg-title">📋 Historial</h1>

          {/* Área de contenido */}
          <div className="hist-content">

            {/* Carga inicial */}
            {loading && (
              <div className="hist-loading"><div className="spinner" /></div>
            )}

            {/* Sin turnos en historial */}
            {!loading && historial.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>Sin historial</h3>
                <p>Todavía no tenés turnos en tu historial.</p>
              </div>
            )}

            {/* Lista de turnos */}
            {!loading && historial.length > 0 && (
              <div className="hist-list">
                {historial.map((turno, idx) => (
                  <TurnoCard
                    key={`hist-${idx}`}
                    turno={turno}
                    onSelect={() => setSelectedTurno(turno)}
                  />
                ))}

                {/* Botón cargar más */}
                {hayMas && (
                  <button
                    className="btn hist-btn-mas"
                    onClick={handleCargarMas}
                    disabled={loadingMore}
                    type="button"
                  >
                    {loadingMore
                      ? <span className="spinner spinner-sm" />
                      : 'Cargar más'}
                  </button>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal de detalle del turno */}
      {selectedTurno && (
        <TurnoDetailModal
          turno={selectedTurno}
          onClose={() => setSelectedTurno(null)}
          onDeleted={handleDeleted}
          onError={(err) => { setSelectedTurno(null); setBackError(err) }}
          readOnly={true}
        />
      )}

      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </div>
  )
}
