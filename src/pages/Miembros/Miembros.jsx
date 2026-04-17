import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { empresaService } from '../../services/empresaService'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import InvitarMiembroModal from '../../components/InvitarMiembroModal/InvitarMiembroModal'
import MiembroDetailModal from '../../components/MiembroDetailModal/MiembroDetailModal'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import { getRolLabel } from '../../utils/rolUtils'
import './Miembros.css'

const ROL_CLASS = {
  PROPIETARIO:      'miem-card__badge--propietario',
  GERENTE_EMPRESA:  'miem-card__badge--gerente-empresa',
  GERENTE_SUCURSAL: 'miem-card__badge--gerente-sucursal',
  EMPLEADO:         'miem-card__badge--empleado',
}

const formatDni = (dni) => dni?.replace(/\B(?=(\d{3})+(?!\d))/g, '.') ?? ''

/**
 * Convierte la respuesta del backend en una lista plana normalizada.
 * Cada elemento: { miembro, tipo, rolEmpresa, sucursales }
 */
function normalizarMiembros(data) {
  const empresa = (data.miembros_empresa ?? []).map(m => ({
    miembro:    m.miembro,
    tipo:       'empresa',
    rolEmpresa: m.rol,
    sucursales: [],
  }))
  const sucursal = (data.miembros_sucursales ?? []).map(m => ({
    miembro:    m.miembro,
    tipo:       'sucursal',
    rolEmpresa: null,
    sucursales: m.sucursales,
  }))
  return [...empresa, ...sucursal]
}

/**
 * Tarjeta de miembro — misma estructura visual que ClienteCard.
 * Muestra el rol como badge en lugar del estado activo/inactivo.
 */
function MiembroCard({ norm, rolActual, esSelf, numSucursales, miRol, onSelect }) {
  const nombreRef = useRef(null)
  const texto = `${norm.miembro.apellido}, ${norm.miembro.nombre}`

  // Reduce el font-size si el nombre desborda (igual que en ClienteCard)
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
 * Página de miembros de la empresa.
 * Solo accesible para PROPIETARIO y GERENTE_EMPRESA.
 */
export default function Miembros() {
  const { id: empresaId }      = useParams()
  const navigate               = useNavigate()
  const location               = useLocation()
  const { empresaPanel, setEmpresaPanel, user, clearEmpresaNotifs } = useAuth()
  const userId = user?.id


  const [miembros,             setMiembros]             = useState([])
  const [sucursales,           setSucursales]           = useState([])
  const [miRol,                setMiRol]                = useState(null)
  const [loading,              setLoading]              = useState(true)
  const [selectedSucursal,     setSelectedSucursal]     = useState(null)
  const [sidebarOpen,          setSidebarOpen]          = useState(false)
  const [search,               setSearch]               = useState('')
  const [miembroSeleccionado,  setMiembroSeleccionado]  = useState(null)
  const [invitarOpen,          setInvitarOpen]          = useState(false)
  const [modificarRolOpen,     setModificarRolOpen]     = useState(false)
  const [abandonarOpen,        setAbandonarOpen]        = useState(false)
  const [actionLoading,        setActionLoading]        = useState(false)
  const [backError,            setBackError]            = useState(null)

  // Si la empresa tiene una sola sucursal Y el rol del usuario es de nivel empresa,
  // el error "miembro no encontrado en sucursal" se muestra como error de empresa.
  // Los gerentes de sucursal operan en contexto de sucursal, así que ven el mensaje original.
  const handleError = (err) => {
    const esRolEmpresa = miRol === 'PROPIETARIO' || miRol === 'GERENTE_EMPRESA'
    if (err?.code === 'SUCURSAL_MIEMBRO_NOT_FOUND' && sucursales.length === 1 && esRolEmpresa) {
      setBackError({ ...err, code: 'EMPRESA_MIEMBRO_NOT_FOUND' })
    } else {
      setBackError(err)
    }
  }

  // Cierra sidebar al pasar a desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setSidebarOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carga sucursales y rol propio una sola vez: desde caché del contexto si ya se pasó
  // por HomeEmpresa, o con un GET como fallback (acceso directo por URL).
  useEffect(() => {
    const cached = empresaPanel?.empresaId === String(empresaId)
    if (cached) {
      setSucursales(empresaPanel.panel.sucursales ?? [])
      setMiRol(empresaPanel.panel.rol)
      return
    }
    empresaService.getPanel(empresaId)
      .then(data => { setEmpresaPanel(empresaId, data); setSucursales(data.sucursales ?? []); setMiRol(data.rol) })
      .catch(err => setBackError(err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  // Carga (y recarga) la lista de miembros — se llama al montar y tras cada acción
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const miembrosData = await empresaService.getMiembros(empresaId)
      setMiembros(normalizarMiembros(miembrosData))
    } catch (err) {
      setBackError(err)
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => { fetchData() }, [fetchData])

  // Abre el modal de detalle si se llegó (o ya estaba) en la página con openUsuarioId en el state.
  // Limpia el state tras consumirlo para no retriggear si se recarga la lista.
  useEffect(() => {
    const openId = location.state?.openUsuarioId
    if (!openId || miembros.length === 0) return
    const found = miembros.find((norm) => norm.miembro.id === openId)
    if (found) {
      setMiembroSeleccionado(found)
      navigate(location.pathname, { replace: true, state: { ...location.state, openUsuarioId: undefined } })
    }
  }, [miembros, location.state?.openUsuarioId]) // eslint-disable-line

  // Filtra la lista según sucursal seleccionada y término de búsqueda
  const miembrosFiltrados = useMemo(() => {
    let lista = miembros

    // Filtro de sucursal: los miembros de empresa siempre aparecen;
    // los de sucursal solo si pertenecen a la sucursal seleccionada
    if (selectedSucursal) {
      lista = lista.filter(norm =>
        norm.tipo === 'empresa' ||
        norm.sucursales.some(s => String(s.id) === String(selectedSucursal.id))
      )
    }

    // Búsqueda local por nombre, apellido, DNI, email o rol
    const q = search.trim().toLowerCase()
    if (q) {
      lista = lista.filter(norm => {
        const rolActual = norm.rolEmpresa ?? norm.sucursales[0]?.rol ?? ''
        const rolLabel  = getRolLabel(rolActual, sucursales.length, miRol).toLowerCase()
        return (
          norm.miembro.apellido.toLowerCase().includes(q) ||
          norm.miembro.nombre.toLowerCase().includes(q)   ||
          (norm.miembro.dni ?? '').toLowerCase().includes(q) ||
          norm.miembro.email.toLowerCase().includes(q)    ||
          rolLabel.includes(q)
        )
      })
    }

    return lista
  }, [miembros, selectedSucursal, search])

  // Determina el rol a mostrar en la tarjeta (considera el filtro activo)
  const getRolCard = (norm) => {
    if (norm.tipo === 'empresa') return norm.rolEmpresa
    if (selectedSucursal) {
      const match = norm.sucursales.find(s => String(s.id) === String(selectedSucursal.id))
      return match?.rol ?? norm.sucursales[0]?.rol
    }
    return norm.sucursales[0]?.rol
  }

  // Callbacks post-acción
  const handleUpdated = (updatedData) => {
    if (updatedData?.miembro) {
      // MiembroSucursalOut devuelto por add_miembro — actualiza en-place sin refetch
      const normed = {
        miembro:    updatedData.miembro,
        tipo:       'sucursal',
        rolEmpresa: null,
        sucursales: updatedData.sucursales,
      }
      setMiembros(prev => prev.map(m => m.miembro.id === normed.miembro.id ? normed : m))
      setMiembroSeleccionado(normed)
    } else {
      fetchData()
    }
  }
  const handleDeleted = () => { fetchData(); setMiembroSeleccionado(null) }
  const handleInvited = () => { fetchData(); setInvitarOpen(false) }

  // Modifica el propio rol (solo PROPIETARIO → GERENTE_EMPRESA)
  const handleModificarMiRol = async () => {
    setActionLoading(true)
    try {
      await empresaService.updateMiRol(empresaId, { nuevo_rol: 'GERENTE_EMPRESA', sucursal_id: null })
      setModificarRolOpen(false)
      fetchData()
    } catch (err) {
      setBackError(err)
      setModificarRolOpen(false)
    } finally {
      setActionLoading(false)
    }
  }

  // Abandona la empresa y redirige a mis empresas
  const handleAbandonar = async () => {
    setActionLoading(true)
    try {
      await empresaService.leaveEmpresa(empresaId)
      clearEmpresaNotifs()
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
        right={<UserTopBarRight empresaId={empresaId} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        <EmpresaSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          empresaId={empresaId}
          activeKey="miembros"
        />

        <main className="hp-main">

          {/* ── Título ── */}
          <div className="svc-header">
            <h1 className="svc-header__title"><span style={{ position: 'relative', top: -2.5 }}>👥</span> Miembros</h1>
          </div>

          <div className="miem-content">

            {/* ── Fila de acciones propias + selector de sucursal ── */}
            <div className="miem-actions-row">
              <button className="btn miem-action-btn" onClick={() => setInvitarOpen(true)} disabled={loading}>
                + Invitar miembro
              </button>
              <button className="btn miem-action-btn miem-action-btn--orange" onClick={() => setAbandonarOpen(true)} disabled={loading}>
                Abandonar empresa
              </button>
              {miRol === 'PROPIETARIO' && (
                <button className="btn miem-action-btn miem-action-btn--indigo" onClick={() => setModificarRolOpen(true)} disabled={loading}>
                  Modificar mi rol
                </button>
              )}

              {/* Selector de sucursal — solo sucursales activas, a la derecha */}
              {!loading && sucursales.filter(s => s.activa !== false).length > 1 && (
                <div className="miem-actions-row__sucursal">
                  <CustomSelect
                    options={[
                      { value: '', label: 'Todas' },
                      ...sucursales
                        .filter(s => s.activa !== false)
                        .map(s => ({ value: String(s.id), label: s.nombre ?? `Sucursal ${s.id}` })),
                    ]}
                    value={String(selectedSucursal?.id ?? '')}
                    onChange={val => {
                      const found = sucursales.find(s => String(s.id) === val)
                      setSelectedSucursal(found ?? null)
                      setSearch('')
                    }}
                    width="100%"
                    height={36}
                  />
                </div>
              )}
            </div>

            {/* ── Buscador local ── */}
            <div className="miem-search-row">
              <div className="hp-search__bar miem-search-row__input">
                <span className="hp-search__icon">🔍</span>
                <input
                  type="search"
                  className="hp-search__input"
                  placeholder="Buscar por nombre, apellido, DNI, email o rol…"
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
                    numSucursales={sucursales.length}
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
          empresaId={empresaId}
          sucursales={sucursales}
          miRol={miRol}
          userId={userId}
          onClose={() => setMiembroSeleccionado(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onError={handleError}
        />
      )}

      {invitarOpen && (
        <InvitarMiembroModal
          empresaId={empresaId}
          sucursales={sucursales}
          miRol={miRol}
          onClose={() => setInvitarOpen(false)}
          onInvited={handleInvited}
          onError={setBackError}
        />
      )}

      {modificarRolOpen && (
        <ConfirmModal
          icon="🔄"
          message="¿Deseás cambiar tu rol de Propietario a Gerente de empresa?"
          confirmText="Confirmar"
          confirmVariant="btn-indigo"
          loading={actionLoading}
          onConfirm={handleModificarMiRol}
          onCancel={() => setModificarRolOpen(false)}
        />
      )}

      {abandonarOpen && (
        <ConfirmModal
          icon="🚪"
          message="¿Estás seguro que querés abandonar esta empresa?"
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
