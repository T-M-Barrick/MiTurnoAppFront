import { useState, useEffect, useRef } from 'react'
import { useFitPlaceholder } from '../../utils/useFitPlaceholder'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { usuarioService } from '../../services/usuarioService'
import AppTopBar, { ThemeIcon } from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import logoMiturno from '../../assets/logo-miturno.png'
import TurnoCard from '../../components/TurnoCard/TurnoCard'
import TurnoDetailModal from '../../components/TurnoDetailModal/TurnoDetailModal'
import EmpresaCard from '../../components/EmpresaCard/EmpresaCard'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import './HomeUsuario.css'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutos

export default function HomeUsuario() {
  const { user, updateUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // ---- Turnos ----
  const [turnos, setTurnos]     = useState(user?.turnos ?? [])
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null)


  // ---- Búsqueda (se restaura si se vuelve desde PerfilSucursal) ----
  const [search, setSearch]             = useState(location.state?.search    ?? '')
  const [buscando, setBuscando]         = useState(!!location.state?.resultados)
  const [resultados, setResultados]     = useState(location.state?.resultados ?? null)
  const [loadingSearch, setLoadingSearch] = useState(false)

  // ---- Favoritos (Set de IDs para O(1) lookup) ----
  const [favoritosIds, setFavoritosIds] = useState(
    () => new Set((user?.favoritos ?? []).map((f) => f.id))
  )

  // ---- UI ----
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [backError, setBackError]     = useState(null)

  // Ref para bloquear volverATurnos mientras hay búsqueda activa
  const busquedaActivaRef = useRef(false)
  const searchInputRef    = useRef(null)
  useFitPlaceholder(searchInputRef, 'Buscar por empresa o rubro')

  // Cierra sidebar en resize a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  // Refresca datos del usuario (incluidos turnos) cada vez que se monta el home
  useEffect(() => {
    const refresh = async () => {
      try {
        const userData = await usuarioService.getMe()
        if (userData) {
          updateUser(userData)
          setTurnos(userData.turnos ?? [])
        }
      } catch { /* ignorar errores de red */ }
    }
    refresh()
  }, []) // eslint-disable-line

  // Abre el modal de detalle si se llegó (o ya estaba) en la página con openTurnoId en el state.
  // Limpia el state tras consumirlo para no retriggear si se actualizan los turnos.
  useEffect(() => {
    const openId = location.state?.openTurnoId
    if (!openId || turnos.length === 0) return
    const found = turnos.find((t) => t.id === openId)
    if (found) {
      setTurnoSeleccionado(found)
      navigate(location.pathname, { replace: true, state: { ...location.state, openTurnoId: undefined } })
    }
  }, [turnos, location.state?.openTurnoId]) // eslint-disable-line

  // Polling de estados cada 5 min
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const estados = await usuarioService.getEstadosTurnos()
        setTurnos((prev) =>
          prev.map((t) => {
            const nuevo = estados.find((e) => e.id === t.id)
            return nuevo ? { ...t, estado_turno: nuevo.estado } : t
          })
        )
      } catch {
        // ignorar errores silenciosamente
      }
    }, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [])

  // ---- Búsqueda (Enter o click en ícono) ----
  const ejecutarBusqueda = async () => {
    const query = search.trim()
    if (query.length < 3) return

    const lat = user?.direcciones?.[0]?.lat ?? -34.6
    const lng = user?.direcciones?.[0]?.lng ?? -58.4

    busquedaActivaRef.current = true
    setLoadingSearch(true)
    setBuscando(true)
    setResultados(null)
    try {
      const data = await usuarioService.buscarSucursales(query, lat, lng)
      setResultados(data)
    } catch (err) {
      setBackError(err)
      setBuscando(false)
    } finally {
      setLoadingSearch(false)
      busquedaActivaRef.current = false
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ejecutarBusqueda()
    }
  }

  // Agrega o quita de favoritos con actualización optimista
  const handleToggleFavorito = async (sucursalId) => {
    const isFav = favoritosIds.has(sucursalId)
    // Actualización optimista
    setFavoritosIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(sucursalId)
      else next.add(sucursalId)
      return next
    })
    try {
      if (isFav) {
        await usuarioService.deleteFavorito(sucursalId)
        updateUser({ favoritos: (user?.favoritos ?? []).filter(f => f.id !== sucursalId) })
      } else {
        const suc = await usuarioService.addFavorito(sucursalId)
        updateUser({ favoritos: [...(user?.favoritos ?? []), suc] })
      }
    } catch (err) {
      // Revertir si falla
      setFavoritosIds((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(sucursalId)
        else next.delete(sucursalId)
        return next
      })
      setBackError(err)
    }
  }

  const volverATurnos = () => {
    setBuscando(false)
    setResultados(null)
    setSearch('')
  }

  const handleTurnoCancelado = (turnoActualizado) => {
    setTurnos((prev) =>
      prev.map((t) => t.id === turnoActualizado.id ? turnoActualizado : t)
    )
    setTurnoSeleccionado(turnoActualizado)
  }

  // Actualiza el turno en lista (cumplido / no cumplido) y mantiene el modal abierto
  const handleTurnoActualizado = (turnoActualizado) => {
    setTurnos((prev) =>
      prev.map((t) => t.id === turnoActualizado.id ? turnoActualizado : t)
    )
    setTurnoSeleccionado(turnoActualizado)
  }

  // Elimina el turno de la lista y cierra el modal
  const handleTurnoEliminado = (turnoId) => {
    setTurnos((prev) => prev.filter((t) => t.id !== turnoId))
    setTurnoSeleccionado(null)
  }

  // Ordena turnos: CONFIRMADO primero, luego por fecha
  const turnosOrdenados = [...turnos].sort((a, b) => {
    const aConf = a.estado_turno === 'CONFIRMADO'
    const bConf = b.estado_turno === 'CONFIRMADO'
    if (aConf && !bConf) return -1
    if (!aConf && bConf) return 1
    return new Date(a.fecha_hora) - new Date(b.fecha_hora)
  })

  return (
    <div className="hp">

      {/* ═══════════════════════════════════
          TOPBAR ROJA (componente compartido)
          ═══════════════════════════════════ */}
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

      {/* ═══════════════════════════════════
          CUERPO: sidebar + main
          ═══════════════════════════════════ */}
      <div className="hp-body">

        {/* Overlay mobile */}
        <div
          className={`hp-sidebar-overlay ${sidebarOpen ? 'hp-sidebar-overlay--open' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ─── SIDEBAR ─── */}
        <aside className={`hp-sidebar ${sidebarOpen ? 'hp-sidebar--open' : ''}`} aria-label="Navegación principal">

          {/* Cabecera sidebar — visible solo en mobile */}
          <div className="hp-sidebar__head">
            <img
              src={logoMiturno}
              alt="MiTurno"
              className="hp-sidebar__logo"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <button
              className="hp-sidebar__close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Navegación */}
          <nav className="hp-sidebar__nav">
            <button
              className={`hp-sidebar__item ${!buscando ? 'hp-sidebar__item--active' : ''}`}
              onClick={() => { setSidebarOpen(false); volverATurnos() }}
            >
              <span className="hp-sidebar__icon">🏠</span>
              Inicio
            </button>
            <a
              href="#/mis-empresas"
              className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/mis-empresas') }}
            >
              <span className="hp-sidebar__icon">🏢</span>
              Mis Empresas
            </a>
            <a
              href="#/historial"
              className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/historial') }}
            >
              <span className="hp-sidebar__icon">📋</span>
              Historial
            </a>
            <a
              href="#/favoritos"
              className="hp-sidebar__item"
              onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setSidebarOpen(false); navigate('/favoritos') }}
            >
              <span className="hp-sidebar__icon">⭐</span>
              Favoritos
            </a>
          </nav>

          {/* Footer: tema */}
          <div className="hp-sidebar__footer">
            <button className="hp-sidebar__item hp-sidebar__theme" onClick={toggleTheme}>
              <ThemeIcon theme={theme} />
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </button>
          </div>
        </aside>

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main className="hp-main">

          {/* Barra de búsqueda */}
          <div className="hp-search">
            <div className="hp-search__bar">
              <span className="hp-search__icon hp-search__icon--btn" onClick={ejecutarBusqueda} role="button" aria-label="Buscar">🔍</span>
              <input
                type="search"
                className="hp-search__input"
                ref={searchInputRef}
                placeholder="Buscar por empresa o rubro"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  if (!e.target.value && !busquedaActivaRef.current) volverATurnos()
                }}
                onKeyDown={handleSearchKeyDown}
                aria-label="Buscar empresa"
              />
            </div>
            {search.length > 0 && search.length < 3 && (
              <p className="hp-search__hint hp-search__hint--error">Ingresá al menos 3 caracteres y presioná Enter para buscar</p>
            )}
          </div>

          {/* Zona de contenido */}
          <div className="hp-content">
          <div className="hp-content__inner">

            {/* Vista: resultados de búsqueda */}
            {buscando && (
              <>
                <div className="hp-content__header">
                  <span className="hp-content__count">
                    {loadingSearch ? 'Buscando…' : resultados
                      ? `${resultados.length} resultado${resultados.length !== 1 ? 's' : ''}`
                      : ''}
                  </span>
                </div>

                {loadingSearch && (
                  <div className="loading-inline"><div className="spinner" /></div>
                )}

                {!loadingSearch && resultados?.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>Sin resultados</h3>
                    <p>No hemos encontrado empresas con ese nombre o rubro.</p>
                  </div>
                )}

                <div className="hp-empresas-grid">
                  {!loadingSearch && resultados?.map((suc) => (
                    <EmpresaCard
                      key={suc.id}
                      sucursal={suc}
                      href={`#/sucursal/${suc.id}`}
                      onClick={(e) => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(`/sucursal/${suc.id}`, { state: { sucursal: suc, search, resultados } }) }}
                      isFavorito={favoritosIds.has(suc.id)}
                      onToggleFavorito={handleToggleFavorito}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Vista: turnos */}
            {!buscando && (
              <>
                {turnosOrdenados.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <h3>No tenés turnos</h3>
                    <p>Buscá una empresa en la barra de arriba para reservar tu primer turno.</p>
                  </div>
                )}

                {turnosOrdenados.length > 0 && (
                  <div className="hp-turnos-grid">
                    {turnosOrdenados.map((turno) => (
                      <TurnoCard
                        key={turno.id}
                        turno={turno}
                        onSelect={() => setTurnoSeleccionado(turno)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </main>
      </div>

      {/* ─── Modales ─── */}
      <TurnoDetailModal
        turno={turnoSeleccionado}
        onClose={() => setTurnoSeleccionado(null)}
        onCanceled={handleTurnoCancelado}
        onUpdated={handleTurnoActualizado}
        onDeleted={handleTurnoEliminado}
        onError={setBackError}
      />
      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
