import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import SucursalTopBarRight from '../../components/SucursalTopBarRight/SucursalTopBarRight'
import SucursalSidebar from '../../components/SucursalSidebar/SucursalSidebar'
import MiembroDetailModal from '../../components/MiembroDetailModal/MiembroDetailModal'
import InvitarMiembroModal from '../../components/InvitarMiembroModal/InvitarMiembroModal'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import { getRolLabel } from '../../utils/rolUtils'
import '../Miembros/Miembros.css'
import './MiembrosSucursal.css'

const ROL_CLASS = {
  PROPIETARIO:      'miem-card__badge--propietario',
  GERENTE_EMPRESA:  'miem-card__badge--gerente-empresa',
  GERENTE_SUCURSAL: 'miem-card__badge--gerente-sucursal',
  EMPLEADO:         'miem-card__badge--empleado',
}

const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''

function normalizarMiembros(items, sucursalId) {
  return (items ?? []).map(item => ({
    miembro:    item.miembro,
    tipo:       'sucursal',
    rolEmpresa: null,
    sucursales: [{ id: Number(sucursalId), rol: item.rol }],
  }))
}

function MiembroCard({ norm, rolActual, esSelf, numSucursales, miRol, onSelect }) {
  const nombreRef = useRef(null)
  const texto = `${norm.miembro.apellido}, ${norm.miembro.nombre}`

  useLayoutEffect(() => {
    const el = nombreRef.current
    if (!el) return
    el.style.fontSize = '15px'
    if (el.scrollWidth > el.clientWidth) el.style.fontSize = '12px'
  }, [texto])

  return (
    <article
      className={`cli-card${esSelf ? ' miem-card--self' : ''}`}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      aria-label={`Miembro ${texto}`}
    >
      <div className="cli-card__top">
        <span className="cli-card__nombre" ref={nombreRef}>{texto}</span>
      </div>
      <div className="cli-card__info">
        <div className="cli-card__meta-col">
          <span className="cli-card__meta">
            <span className="cli-card__meta-icon cli-card__meta-icon--dni">🪪</span>
            {formatDni(norm.miembro.dni)}
          </span>
          <span className="cli-card__meta cli-card__meta--email">
            <span className="cli-card__meta-icon cli-card__meta-icon--email">📧</span>
            <span className="cli-card__email">{norm.miembro.email}</span>
          </span>
        </div>
        {rolActual && (
          <div className="cli-card__badges">
            <span className={`cli-card__badge miem-card__badge ${ROL_CLASS[rolActual] ?? ''}`}>
              {getRolLabel(rolActual, numSucursales, miRol)}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}

/**
 * Página de miembros de sucursal para GERENTE_SUCURSAL.
 * Diseño idéntico a Miembros (empresa), adaptado al contexto de sucursal.
 */
export default function MiembrosSucursal() {
  const { id: sucursalId } = useParams()
  const navigate           = useNavigate()
  const location           = useLocation()
  const { sucursalPanel, user } = useAuth()
  const userId = user?.id

  const panel         = sucursalPanel?.sucursalId === String(sucursalId) ? sucursalPanel.panel : null
  const miRol         = panel?.rol ?? null
  const numSucursales = panel?.cantidad_sucursales ?? 1

  const sucursales = panel
    ? [{ id: Number(sucursalId), nombre: panel.nombre_sucursal ?? null, activa: true }]
    : []

  const [miembros,            setMiembros]            = useState([])
  const [loading,             setLoading]             = useState(true)
  const [sidebarOpen,         setSidebarOpen]         = useState(false)
  const [search,              setSearch]              = useState('')
  const [miembroSeleccionado, setMiembroSeleccionado] = useState(null)
  const [invitarOpen,         setInvitarOpen]         = useState(false)
  const [abandonarOpen,       setAbandonarOpen]       = useState(false)
  const [actionLoading,       setActionLoading]       = useState(false)
  const [backError,           setBackError]           = useState(null)

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sucursalService.getMiembrosSucursal(sucursalId)
      setMiembros(normalizarMiembros(data, sucursalId))
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }, [sucursalId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const openId = location.state?.openUsuarioId
    if (!openId || miembros.length === 0) return
    const found = miembros.find((norm) => norm.miembro.id === openId)
    if (found) {
      setMiembroSeleccionado(found)
      navigate(location.pathname, { replace: true, state: { ...location.state, openUsuarioId: undefined } })
    }
  }, [miembros, location.state?.openUsuarioId]) // eslint-disable-line

  const miembrosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return miembros
    return miembros.filter(norm => {
      const rolActual = norm.sucursales[0]?.rol ?? ''
      const rolLabel  = getRolLabel(rolActual, numSucursales, miRol).toLowerCase()
      return (
        norm.miembro.apellido.toLowerCase().includes(q) ||
        norm.miembro.nombre.toLowerCase().includes(q)   ||
        (norm.miembro.dni ?? '').toLowerCase().includes(q) ||
        norm.miembro.email.toLowerCase().includes(q)    ||
        rolLabel.includes(q)
      )
    })
  }, [miembros, search, numSucursales, miRol])

  const getRolCard = (norm) => norm.sucursales[0]?.rol

  const handleUpdated = (updatedData) => {
    if (updatedData?.miembro) {
      const normed = {
        miembro:    updatedData.miembro,
        tipo:       'sucursal',
        rolEmpresa: null,
        sucursales: updatedData.sucursales ?? [{ id: Number(sucursalId), rol: updatedData.rol }],
      }
      setMiembros(prev => {
        const sinUsuario = prev.filter(m => m.miembro.id !== normed.miembro.id)
        return [...sinUsuario, normed]
      })
      setMiembroSeleccionado(normed)
    } else {
      fetchData()
    }
  }
  const handleDeleted = () => { fetchData(); setMiembroSeleccionado(null) }
  const handleInvited = () => { fetchData(); setInvitarOpen(false) }

  const handleAbandonar = async () => {
    setActionLoading(true)
    try {
      await sucursalService.leaveSucursal(sucursalId)
      navigate('/mis-empresas')
    } catch (err) {
      setBackError(err)
      setAbandonarOpen(false)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="miem-page">

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
        right={<SucursalTopBarRight sucursalId={sucursalId} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        <SucursalSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sucursalId={sucursalId}
          miRol={miRol}
          activeKey="miembros"
        />

        <main className="hp-main">

          <div className="svc-header">
            <h1 className="svc-header__title"><span style={{ position: 'relative', top: -2.5 }}>👥</span> Miembros</h1>
          </div>

          <div className="miem-content">

            {/* ── Fila de acciones ── */}
            <div className="miem-actions-row">
              {miRol === 'GERENTE_SUCURSAL' && (
                <button className="btn svc-btn-add" onClick={() => setInvitarOpen(true)} disabled={loading}>
                  + Invitar empleado
                </button>
              )}
              <button className="btn svc-btn-add svc-btn-add--orange" onClick={() => setAbandonarOpen(true)} disabled={loading}>
                Abandonar sucursal
              </button>
            </div>

            {/* ── Buscador local ── */}
            <div className="miem-search-row">
              <div className="hp-search__bar miem-search-row__input">
                <span className="hp-search__icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#d1d5db" aria-hidden="true">
                    <path d="M4 4h16l-6 8v8h-4v-8L4 4z"/>
                  </svg>
                </span>
                <input
                  type="search"
                  className="hp-search__input"
                  placeholder="Filtrar por nombre, apellido, DNI, email o rol"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Loading */}
            {loading && <div className="hist-loading"><div className="spinner" /></div>}

            {/* Sin resultados */}
            {!loading && miembrosFiltrados.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <h3>{search ? 'Sin resultados' : 'Sin miembros'}</h3>
                <p>{search ? 'No se encontraron miembros con esa búsqueda.' : 'No hay miembros registrados.'}</p>
              </div>
            )}

            {/* Grid de tarjetas */}
            {!loading && miembrosFiltrados.length > 0 && (
              <div className="cli-grid miem-grid">
                {miembrosFiltrados.map(norm => (
                  <MiembroCard
                    key={`${norm.tipo}-${norm.miembro.id}`}
                    norm={norm}
                    rolActual={getRolCard(norm)}
                    esSelf={norm.miembro.id === userId}
                    numSucursales={numSucursales}
                    miRol={miRol}
                    onSelect={() => setMiembroSeleccionado(norm)}
                  />
                ))}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── Modales ── */}
      {miembroSeleccionado && (
        <MiembroDetailModal
          miembro={miembroSeleccionado}
          empresaId={panel?.empresa_id}
          sucursales={sucursales}
          miRol={miRol}
          userId={userId}
          onClose={() => setMiembroSeleccionado(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onError={setBackError}
        />
      )}

      {invitarOpen && (
        <InvitarMiembroModal
          empresaId={panel?.empresa_id}
          sucursales={sucursales}
          miRol={miRol}
          onClose={() => setInvitarOpen(false)}
          onInvited={handleInvited}
          onError={setBackError}
        />
      )}

      {abandonarOpen && (
        <ConfirmModal
          icon="🚪"
          message="¿Estás seguro que querés abandonar esta sucursal?"
          confirmText="Abandonar"
          confirmVariant="btn-orange"
          loading={actionLoading}
          onConfirm={handleAbandonar}
          onCancel={() => setAbandonarOpen(false)}
        />
      )}

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
