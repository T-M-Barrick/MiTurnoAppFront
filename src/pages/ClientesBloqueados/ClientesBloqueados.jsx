import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useParams, useMatch } from 'react-router-dom'
import { sucursalService } from '../../services/sucursalService'
import { empresaService } from '../../services/empresaService'
import { useAuth } from '../../context/AuthContext'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import SucursalTopBarRight from '../../components/SucursalTopBarRight/SucursalTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import SucursalSidebar from '../../components/SucursalSidebar/SucursalSidebar'
import BloqueoDetailModal from '../../components/BloqueoDetailModal/BloqueoDetailModal'
import BloquearClienteModal from '../../components/BloquearClienteModal/BloquearClienteModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import './ClientesBloqueados.css'

/**
 * Tarjeta de cliente bloqueado.
 * Idéntica a ClienteCard pero sin los badges de estado activo/inactivo.
 */
function ClienteBloqueadoCard({ bloqueo, onSelect }) {
  const { cliente } = bloqueo
  const formatDni   = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''
  const nombreRef   = useRef(null)
  const texto       = `${cliente.apellido}, ${cliente.nombre}`

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
      aria-label={`Cliente bloqueado ${cliente.apellido}, ${cliente.nombre}`}
    >
      {/* Fila 1: nombre */}
      <div className="cli-card__top">
        <span className="cli-card__nombre" ref={nombreRef}>{texto}</span>
      </div>

      {/* Fila 2: DNI + email (sin badge de estado) */}
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
      </div>
    </article>
  )
}

/**
 * Página de clientes bloqueados de una sucursal.
 * Permite filtrar localmente, bloquear nuevos clientes y desbloquear desde el detalle.
 */
export default function ClientesBloqueados() {
  const { id }         = useParams()
  const matchSucursal  = useMatch('/sucursal/:id/*')
  const isSucursalMode = !!matchSucursal
  const empresaId      = isSucursalMode ? null : id
  const { empresaPanel, setEmpresaPanel, sucursalPanel } = useAuth()
  const miRol          = isSucursalMode ? (sucursalPanel?.panel?.rol ?? null) : null

  // Sucursales
  const [sucursales,       setSucursales]       = useState([])
  const [selectedSucursal, setSelectedSucursal] = useState(null)
  const [loadingInit,      setLoadingInit]      = useState(true)

  // Bloqueos
  const [bloqueos,    setBloqueos]    = useState([])
  const [loadingList, setLoadingList] = useState(false)

  // Filtro local
  const [searchInput, setSearchInput] = useState('')

  // UI
  const [bloqueoSeleccionado, setBloqueoSeleccionado] = useState(null)
  const [formOpen,            setFormOpen]            = useState(false)
  const [sidebarOpen,         setSidebarOpen]         = useState(false)
  const [backError,           setBackError]           = useState(null)
  const [success,             setSuccess]             = useState(null)
  // Incrementar este valor resetea el sub-modal de BloquearClienteModal
  const [bloquearResetKey,    setBloquearResetKey]    = useState(0)

  // Cierra sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carga sucursales al montar.
  // En modo sucursal: la sucursal está fijada por la URL.
  // En modo empresa: usa panel en caché o lo fetchea.
  useEffect(() => {
    if (isSucursalMode) {
      const nombre = sucursalPanel?.sucursalId === String(id)
        ? sucursalPanel.panel.nombre_sucursal ?? ''
        : ''
      const suc = { id: Number(id), nombre }
      setSucursales([suc])
      setSelectedSucursal(suc)
      setLoadingInit(false)
      return
    }

    const cached = empresaPanel?.empresaId === String(empresaId)
      ? empresaPanel.panel.sucursales ?? []
      : null

    if (cached !== null) {
      const sorted = [...cached].filter(s => s.activa !== false).sort((a, b) => a.id - b.id)
      setSucursales(sorted)
      if (sorted.length >= 1) setSelectedSucursal(sorted[0])
      setLoadingInit(false)
      return
    }

    const fetchInit = async () => {
      setLoadingInit(true)
      try {
        const panelData      = await empresaService.getPanel(empresaId)
        setEmpresaPanel(empresaId, panelData)
        const sucursalesList = panelData.sucursales ?? []
        const sorted = [...sucursalesList].filter(s => s.activa !== false).sort((a, b) => a.id - b.id)
        setSucursales(sorted)
        if (sorted.length >= 1) setSelectedSucursal(sorted[0])
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingInit(false)
      }
    }
    fetchInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSucursalMode])

  // Carga todos los clientes bloqueados de la sucursal seleccionada
  const fetchBloqueos = useCallback(async (sucursalId) => {
    setLoadingList(true)
    setBloqueos([])
    try {
      const data = await sucursalService.getBloqueos(sucursalId)
      setBloqueos(data ?? [])
    } catch (err) {
      setBackError(err)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedSucursal) return
    setSearchInput('')
    fetchBloqueos(selectedSucursal.id)
  }, [selectedSucursal, fetchBloqueos])

  // Filtro local por apellido, nombre, DNI o email
  const bloqueosFiltrados = searchInput.trim()
    ? bloqueos.filter((b) => {
        const q = searchInput.trim().toLowerCase()
        const { cliente } = b
        return (
          cliente.apellido.toLowerCase().includes(q) ||
          cliente.nombre.toLowerCase().includes(q)   ||
          (cliente.dni ?? '').includes(q)             ||
          cliente.email.toLowerCase().includes(q)
        )
      })
    : bloqueos

  // Agrega el nuevo bloqueo al inicio de la lista y muestra modal de éxito.
  // El BloquearClienteModal se cierra recién cuando el usuario acepta el éxito.
  const handleBloqueado = (nuevo) => {
    setBloqueos((prev) => [nuevo, ...prev])
    setSuccess('Cliente bloqueado exitosamente.')
  }

  // Elimina el bloqueo de la lista y cierra el detalle
  const handleDesbloqueado = (clienteId) => {
    setBloqueos((prev) => prev.filter((b) => b.cliente.id !== clienteId))
    setBloqueoSeleccionado(null)
  }

  const loading = loadingInit || loadingList

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
        right={isSucursalMode
          ? <SucursalTopBarRight sucursalId={id} />
          : <UserTopBarRight empresaId={empresaId} />
        }
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        {isSucursalMode
          ? <SucursalSidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              sucursalId={id}
              miRol={miRol}
              activeKey="clientes-bloqueados"
            />
          : <EmpresaSidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              empresaId={empresaId}
              activeKey="clientes-bloqueados"
            />
        }

        <main className="hp-main">

          {/* ── Título — mismo espaciado que Clientes ── */}
          <div className="svc-header">
            <h1 className="svc-header__title">🚫 Clientes Bloqueados</h1>
          </div>

          <div className="cli-content">

            {/* Fila: botón bloquear + selector de sucursal */}
            {!loadingInit && selectedSucursal && (
              <div className="svc-top-bar">
                <button className="btn svc-btn-add btn-danger" onClick={() => setFormOpen(true)} disabled={loading}>
                  + Bloquear cliente
                </button>

                {!isSucursalMode && sucursales.length > 1 && (
                  <CustomSelect
                    options={sucursales.map((s, idx) => ({ value: String(s.id), label: s.nombre?.trim() || `Sucursal ${idx + 1}` }))}
                    value={String(selectedSucursal?.id ?? '')}
                    onChange={(val) => {
                      const found = sucursales.find((s) => String(s.id) === val)
                      if (found) { setSelectedSucursal(found); setSearchInput('') }
                    }}
                    width={285}
                    height={36}
                  />
                )}
              </div>
            )}

            {/* ── Filtro local ── */}
            {selectedSucursal && (
              <div className="cb-search-bar">
                <div className="hp-search__bar cli-search-bar__input">
                  <span className="hp-search__icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#d1d5db" aria-hidden="true">
                      <path d="M4 4h16l-6 8v8h-4v-8L4 4z"/>
                    </svg>
                  </span>
                  <input
                    type="search"
                    className="hp-search__input"
                    placeholder="Filtrar por nombre, apellido, DNI o email"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Sin sucursal seleccionada */}
            {!loading && !selectedSucursal && sucursales.length > 1 && (
              <div className="empty-state">
                <div className="empty-state-icon">🚫</div>
                <h3>Sin sucursal</h3>
                <p>Seleccioná una sucursal para ver sus clientes bloqueados.</p>
              </div>
            )}

            {/* Loading */}
            {loading && <div className="hist-loading"><div className="spinner" /></div>}

            {/* Sin resultados */}
            {!loading && selectedSucursal && bloqueosFiltrados.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">🚫</div>
                <h3>{searchInput ? 'Sin resultados' : 'Sin clientes bloqueados'}</h3>
                <p>{searchInput
                  ? 'No se encontraron clientes con esa búsqueda.'
                  : 'No hay clientes bloqueados en esta sucursal.'
                }</p>
              </div>
            )}

            {/* Grid de tarjetas */}
            {!loading && bloqueosFiltrados.length > 0 && (
              <div className="cli-grid">
                {bloqueosFiltrados.map((b) => (
                  <ClienteBloqueadoCard
                    key={b.cliente.id}
                    bloqueo={b}
                    onSelect={() => setBloqueoSeleccionado(b)}
                  />
                ))}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Modales ── */}
      <BloqueoDetailModal
        bloqueo={bloqueoSeleccionado}
        sucursalId={selectedSucursal?.id}
        numSucursales={sucursales.length}
        onClose={() => setBloqueoSeleccionado(null)}
        onDesbloqueado={handleDesbloqueado}
        onError={setBackError}
      />

      {formOpen && (
        <BloquearClienteModal
          sucursalId={selectedSucursal?.id}
          resetKey={bloquearResetKey}
          onClose={() => setFormOpen(false)}
          onBloqueado={handleBloqueado}
          onError={setBackError}
        />
      )}

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
      <ErrorModal
        success={success}
        onClose={() => { setSuccess(null); setBloquearResetKey((k) => k + 1) }}
      />
    </div>
  )
}
