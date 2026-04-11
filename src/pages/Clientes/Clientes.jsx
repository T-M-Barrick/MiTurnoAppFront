import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { sucursalService } from '../../services/sucursalService'
import { empresaService } from '../../services/empresaService'
import { useAuth } from '../../context/AuthContext'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import ClienteDetailModal from '../../components/ClienteDetailModal/ClienteDetailModal'
import ClienteFormModal from '../../components/ClienteFormModal/ClienteFormModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import './Clientes.css'

/**
 * Tarjeta de cliente para la lista de la sucursal.
 * El nombre se reduce de 15px a 12px antes de aplicar elipsis.
 */
function ClienteCard({ cliente, onSelect }) {
  const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''
  const nombreRef = useRef(null)
  const texto = `${cliente.apellido}, ${cliente.nombre}`

  // Ajusta el font-size del nombre: intenta 15px, si desborda baja a 12px
  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    el.style.fontSize = '15px'
    if (el.scrollWidth > el.clientWidth) el.style.fontSize = '12px'
  }, [texto])

  return (
    <article
      className="cli-card"
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      aria-label={`Cliente ${cliente.apellido}, ${cliente.nombre}`}
    >
      {/* Fila 1: nombre + badge bloqueado (si aplica) */}
      <div className="cli-card__top">
        <span className="cli-card__nombre" ref={nombreRef}>{texto}</span>
        {cliente.bloqueo && (
          <span className="cli-card__badge cli-card__badge--bloqueado">Bloqueado</span>
        )}
      </div>

      {/* Fila 2: DNI + email | badge activo/inactivo */}
      <div className="cli-card__info">
        <div className="cli-card__meta-col">
          <span className="cli-card__meta">
            <span className="cli-card__meta-icon cli-card__meta-icon--dni">🪪</span>
            {formatDni(cliente.dni)}
          </span>
          <span className="cli-card__meta cli-card__meta--email">
            <span className="cli-card__meta-icon cli-card__meta-icon--email">📧</span>
            <span className="cli-card__email">{cliente.email}</span>
          </span>
        </div>
        <div className="cli-card__badges">
          <span className={`cli-card__badge ${cliente.activo ? 'cli-card__badge--activo' : 'cli-card__badge--inactivo'}`}>
            {cliente.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * Página de clientes de una empresa/sucursal.
 * Permite buscar, filtrar por activo/inactivo, crear y ver el detalle de cada cliente.
 */
export default function Clientes() {
  const { id: empresaId }  = useParams()
  const { empresaPanel }   = useAuth()

  // Sucursales
  const [sucursales,       setSucursales]       = useState([])
  const [selectedSucursal, setSelectedSucursal] = useState(null)
  const [loadingInit,      setLoadingInit]      = useState(true)

  // Clientes
  const [clientes,     setClientes]     = useState([])
  const [loadingList,  setLoadingList]  = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [cursor,       setCursor]       = useState(null) // ultimo id | null
  const [hayMas,       setHayMas]       = useState(false)

  // Búsqueda y filtro
  const [searchInput,  setSearchInput]  = useState('')   // valor del input
  const [activoFilter, setActivoFilter] = useState(null) // null=todos, true=activos, false=inactivos

  // UI
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [formOpen,            setFormOpen]            = useState(false)
  const [sidebarOpen,         setSidebarOpen]         = useState(false)
  const [backError,           setBackError]           = useState(null)

  // Cierra sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carga sucursales al montar: usa el panel en caché del contexto si ya fue fetched
  // en HomeEmpresa; de lo contrario hace el GET (acceso directo por URL).
  useEffect(() => {
    const cached = empresaPanel?.empresaId === String(empresaId)
      ? empresaPanel.panel.sucursales ?? []
      : null

    if (cached !== null) {
      setSucursales(cached)
      if (cached.length === 1) setSelectedSucursal(cached[0])
      setLoadingInit(false)
      return
    }

    const fetchInit = async () => {
      setLoadingInit(true)
      try {
        const panelData      = await empresaService.getPanel(empresaId)
        const sucursalesList = panelData.sucursales ?? []
        setSucursales(sucursalesList)
        if (sucursalesList.length === 1) setSelectedSucursal(sucursalesList[0])
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingInit(false)
      }
    }
    fetchInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Función de fetch principal (primera página)
  const fetchClientes = useCallback(async (sucursalId, query, activo) => {
    setLoadingList(true)
    setClientes([])
    setCursor(null)
    setHayMas(false)
    try {
      const opts = { activo, limite: 50 }
      if (query.length >= 3) opts.busqueda = query
      const data = await sucursalService.getClientes(sucursalId, opts)
      setClientes(data.clientes ?? [])
      setCursor(data.ultimo_cursor_id ?? null)
      setHayMas(!!data.ultimo_cursor_id)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  // Carga inicial al seleccionar sucursal (sin filtros)
  useEffect(() => {
    if (!selectedSucursal) return
    setSearchInput('')
    setActivoFilter(null)
    fetchClientes(selectedSucursal.id, '', null)
  }, [selectedSucursal, fetchClientes])

  // Dispara la búsqueda al presionar Enter en el input
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && selectedSucursal) {
      fetchClientes(selectedSucursal.id, searchInput, activoFilter)
    }
  }

  // Carga más clientes usando el cursor
  const handleCargarMas = async () => {
    if (!cursor || loadingMore || !selectedSucursal) return
    setLoadingMore(true)
    try {
      const opts = { idUltimo: cursor, activo: activoFilter, limite: 50 }
      if (searchInput.length >= 3) opts.busqueda = searchInput
      const data = await sucursalService.getClientes(selectedSucursal.id, opts)
      setClientes((prev) => [...prev, ...(data.clientes ?? [])])
      setCursor(data.ultimo_cursor_id ?? null)
      setHayMas(!!data.ultimo_cursor_id)
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingMore(false)
    }
  }

  // Callback tras crear: agrega el nuevo cliente al inicio de la lista y cierra el form
  const handleCreated = (nuevo) => {
    setClientes((prev) => [nuevo, ...prev])
    setFormOpen(false)
  }

  // Callback tras desactivar/reactivar: actualiza el cliente en la lista
  const handleUpdated = (clienteActualizado) => {
    setClientes((prev) =>
      prev.map((c) => c.id === clienteActualizado.id ? clienteActualizado : c)
    )
    setClienteSeleccionado(clienteActualizado)
  }

  const loading = loadingInit || loadingList

  const showSearchHint = false

  return (
    <div className="cli-page">

      {/* ═══ TOPBAR ═══ */}
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
        right={<UserTopBarRight empresaId={empresaId} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        <EmpresaSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          empresaId={empresaId}
          activeKey="clientes"
        />

        <main className="hp-main">

          {/* ── Título centrado — igual que svc-header ── */}
          <div className="svc-header">
            <h1 className="svc-header__title">👤 Clientes</h1>
          </div>

          {/* Selector de sucursal (solo si hay más de una) */}
          {!loadingInit && sucursales.length > 1 && (
            <div className="svc-sucursal-wrap">
              <span className="svc-sucursal-label">Sucursal:</span>
              <CustomSelect
                options={[
                  { value: '', label: 'Seleccioná una sucursal' },
                  ...sucursales.map((s) => ({ value: String(s.id), label: s.nombre })),
                ]}
                value={String(selectedSucursal?.id ?? '')}
                onChange={(val) => {
                  const found = sucursales.find((s) => String(s.id) === val)
                  setSelectedSucursal(found ?? null)
                  setSearchInput('')
                  setSearchQuery('')
                }}
                width="100%"
                height={37}
              />
            </div>
          )}

          <div className="cli-content">

            {/* ── Botón agregar ── */}
            {selectedSucursal && (
              <div className="svc-btn-add-wrap">
                <button className="btn svc-btn-add" onClick={() => setFormOpen(true)} disabled={loading}>
                  + Agregar cliente
                </button>
              </div>
            )}

            {/* ── Buscador + filtro activo ── */}
            {selectedSucursal && (
              <div className="cli-search-bar">
                {/* Misma barra que HomeUsuario */}
                <div className="hp-search__bar cli-search-bar__input">
                  <span className="hp-search__icon hp-search__icon--btn" onClick={() => selectedSucursal && fetchClientes(selectedSucursal.id, searchInput, activoFilter)} role="button" aria-label="Buscar">🔍</span>
                  <input
                    type="search"
                    className="hp-search__input"
                    placeholder="Buscar por DNI, apellido, nombre, email, teléfono u observación…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>

                {/* Filtro activo/inactivo/todos */}
                <div className="cli-filter">
                  {[
                    { label: 'Todos',     value: null  },
                    { label: 'Activos',   value: true  },
                    { label: 'Inactivos', value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      className={`cli-filter__btn ${activoFilter === opt.value ? 'cli-filter__btn--active' : ''}`}
                      onClick={() => setActivoFilter(opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hint de búsqueda */}
            {showSearchHint && (
              <p className="cli-search-hint">Ingresá al menos 3 caracteres para buscar.</p>
            )}

            {/* Sin sucursal */}
            {!loading && !selectedSucursal && sucursales.length > 1 && (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <h3>Sin sucursal</h3>
                <p>Seleccioná una sucursal para ver sus clientes.</p>
              </div>
            )}

            {/* Loading */}
            {loading && <div className="hist-loading"><div className="spinner" /></div>}

            {/* Sin resultados */}
            {!loading && selectedSucursal && clientes.length === 0 && !showSearchHint && (
              <div className="empty-state">
                <div className="empty-state-icon">👤</div>
                <h3>{searchInput ? 'Sin resultados' : 'Sin clientes'}</h3>
                <p>{searchInput ? 'No se encontraron clientes con esa búsqueda.' : 'No hay clientes registrados en esta sucursal.'}</p>
              </div>
            )}

            {/* Lista */}
            {!loading && clientes.length > 0 && (
              <div className="cli-grid">
                {clientes.map((c) => (
                  <ClienteCard
                    key={c.id}
                    cliente={c}
                    onSelect={() => setClienteSeleccionado(c)}
                  />
                ))}

                {hayMas && (
                  <button
                    className="btn hist-btn-mas cli-btn-mas"
                    onClick={handleCargarMas}
                    disabled={loadingMore}
                    type="button"
                  >
                    {loadingMore ? <span className="spinner spinner-sm" /> : 'Cargar más'}
                  </button>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Modales ── */}
      <ClienteDetailModal
        cliente={clienteSeleccionado}
        sucursalId={selectedSucursal?.id}
        onClose={() => setClienteSeleccionado(null)}
        onUpdated={handleUpdated}
        onError={setBackError}
      />

      {formOpen && (
        <ClienteFormModal
          sucursalId={selectedSucursal?.id}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
          onError={setBackError}
        />
      )}

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
