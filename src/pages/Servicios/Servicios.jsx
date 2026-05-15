import { useState, useEffect } from 'react'
import { useParams, useMatch } from 'react-router-dom'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import { useAuth } from '../../context/AuthContext'
import { formatDuracion, getVersionActiva } from '../../utils/dateUtils'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import SucursalTopBarRight from '../../components/SucursalTopBarRight/SucursalTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import SucursalSidebar from '../../components/SucursalSidebar/SucursalSidebar'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import ServicioModal from '../../components/ServicioModal/ServicioModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import './Servicios.css'

/**
 * Tarjeta individual de un servicio.
 */
function ServicioCard({ servicio, onClick }) {
  const version = getVersionActiva(servicio.servicios)

  // Nombre del profesional con DNI formateado
  const formatDni = (dni) => dni ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : null
  const profesionalNombre =
    servicio.profesional_apellido && servicio.profesional_nombre
      ? `${servicio.profesional_apellido}, ${servicio.profesional_nombre}${servicio.profesional_dni ? ` (DNI ${formatDni(servicio.profesional_dni)})` : ''}`
      : null

  return (
    <button className="svc-card" onClick={onClick} type="button">
      {/* Línea 1: nombre del servicio */}
      <div className="svc-card__header">
        <span className="svc-card__name">{servicio.nombre}</span>
      </div>

      {/* Línea 2: duración + precio + bloqueos */}
      {version && (
        <div className="svc-card__meta">
          {version.duracion && (
            <span className="svc-card__meta-item">
              <span className="svc-card__meta-icon" aria-hidden="true">⏱️</span>
              <span className="svc-card__meta-label">Duración:</span>
              <span className="svc-card__meta-value">{formatDuracion(version.duracion)}</span>
            </span>
          )}
          {version.precio !== undefined && version.precio !== null && (
            <span className="svc-card__meta-item">
              <span className="svc-card__meta-icon svc-card__meta-icon--precio" aria-hidden="true">💲</span>
              <span className="svc-card__meta-label">Precio:</span>
              <span className="svc-card__meta-value">${Number(version.precio).toLocaleString('es-AR')}</span>
            </span>
          )}
          {(servicio.excepciones_fechas?.length ?? 0) > 0 && (
            <span className="svc-badge svc-badge--bloqueo">
              <span className="svc-badge__full">Bloqueos de fechas</span>
              <span className="svc-badge__short">BDF</span>
            </span>
          )}
        </div>
      )}

      {/* Línea 3: profesional + badge cancelación limitada */}
      <div className="svc-card__pro">
        <span className="svc-card__pro-icon" aria-hidden="true">💼</span>
        <span className="svc-card__meta-label">Profesional:</span>
        <span className={`svc-card__pro-nombre${profesionalNombre ? '' : ' svc-card__pro--none'}`}>
          {profesionalNombre ?? '—'}
        </span>
        {servicio.cancelacion_turno_limitada && (
          <span className="svc-badge svc-badge--cancel svc-badge--sm">
            <span className="svc-badge__full">Cancelación limitada</span>
            <span className="svc-badge__short">CL</span>
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * Página de Servicios — gestión de servicios de una sucursal de empresa.
 */
export default function Servicios() {
  const { id }         = useParams()
  const matchSucursal  = useMatch('/sucursal/:id/*')
  const isSucursalMode = !!matchSucursal
  const empresaId      = isSucursalMode ? null : id
  const { empresaPanel, setEmpresaPanel, sucursalPanel } = useAuth()
  const miRol          = isSucursalMode ? (sucursalPanel?.panel?.rol ?? null) : null

  // Estado de UI
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [backError,      setBackError]      = useState(null)

  // Datos de empresa y miembros
  const [sucursales,     setSucursales]     = useState([])
  const [miembros,       setMiembros]       = useState(null) // MiembrosEmpresaOut

  // Sucursal seleccionada y sus servicios
  const [selectedSucursal, setSelectedSucursal] = useState(null)
  const [servicios,        setServicios]         = useState([])

  // Estados de carga
  const [loadingInit,     setLoadingInit]    = useState(true)
  const [loadingServicios, setLoadingServicios] = useState(false)

  // Modal de servicio abierto
  const [selectedServicio, setSelectedServicio] = useState(null)

  // Modal de creación de servicio
  const [crearOpen, setCrearOpen] = useState(false)

  // Carga inicial: en modo sucursal fija la sucursal por URL y fetchea solo miembros de sucursal.
  // En modo empresa: usa panel en caché o lo fetchea, y carga miembros de empresa.
  useEffect(() => {
    if (isSucursalMode) {
      const nombre = sucursalPanel?.sucursalId === String(id)
        ? sucursalPanel.panel.nombre_sucursal ?? ''
        : ''
      const suc = { id: Number(id), nombre }
      setSucursales([suc])
      setSelectedSucursal(suc)
      // Carga miembros de la sucursal para asignar profesional en ServicioModal
      sucursalService.getMiembrosSucursal(id)
        .then((data) => {
          // Adapta list[{miembro, rol}] al formato MiembrosEmpresaOut que espera buildMiembrosList:
          // cada item necesita { miembro, sucursales: [{id}] } para que el filtro por sucursalId funcione
          const adapted = (data ?? []).map((item) => ({
            miembro:   item.miembro,
            sucursales: [{ id: Number(id) }],
          }))
          setMiembros({ miembros_empresa: [], miembros_sucursales: adapted })
        })
        .catch(() => setMiembros(null))
        .finally(() => setLoadingInit(false))
      return
    }

    const fetchInit = async () => {
      setLoadingInit(true)
      try {
        const cached = empresaPanel?.empresaId === String(empresaId)
          ? empresaPanel.panel.sucursales ?? []
          : null

        const [sucursalesList, miembrosData] = cached !== null
          ? [cached, await empresaService.getMiembros(empresaId)]
          : await Promise.all([
              empresaService.getPanel(empresaId).then(d => { setEmpresaPanel(empresaId, d); return d.sucursales ?? [] }),
              empresaService.getMiembros(empresaId),
            ])

        const sorted = [...sucursalesList].filter(s => s.activa !== false).sort((a, b) => a.id - b.id)
        setSucursales(sorted)
        setMiembros(miembrosData)
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

  // Carga servicios cuando cambia la sucursal seleccionada
  useEffect(() => {
    if (!selectedSucursal) return
    const fetchServicios = async () => {
      setLoadingServicios(true)
      try {
        const data = await sucursalService.getServicios(selectedSucursal.id)
        setServicios(data ?? [])
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingServicios(false)
      }
    }
    fetchServicios()
  }, [selectedSucursal])

  // Callback para cambios en ServicioBase: actualiza lista y cierra el modal
  const handleServicioUpdated = (updatedServicio) => {
    setServicios((prev) =>
      prev.map((s) => (s.id === updatedServicio.id ? updatedServicio : s))
    )
    setSelectedServicio(null)
  }

  // Callback para cambios en Servicio (versiones): actualiza lista y mantiene el modal abierto
  const handleVersionUpdated = (updatedServicio) => {
    setServicios((prev) =>
      prev.map((s) => (s.id === updatedServicio.id ? updatedServicio : s))
    )
    setSelectedServicio(updatedServicio)
  }

  // Callback cuando se elimina un servicio desde el modal
  const handleServicioDeleted = (servicioBaseId) => {
    setServicios((prev) => prev.filter((s) => s.id !== servicioBaseId))
    setSelectedServicio(null)
  }

  // Callback cuando se crea un servicio nuevo
  const handleServicioCreated = (nuevoServicio) => {
    setServicios((prev) => [...prev, nuevoServicio])
    setCrearOpen(false)
  }

  return (
    <div className="svc-page">

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
        right={isSucursalMode
          ? <SucursalTopBarRight sucursalId={id} />
          : <UserTopBarRight empresaId={empresaId} />
        }
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        {/* ─── SIDEBAR ─── */}
        {isSucursalMode
          ? <SucursalSidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              sucursalId={id}
              miRol={miRol}
              activeKey="servicios"
            />
          : <EmpresaSidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              empresaId={empresaId}
              activeKey="servicios"
            />
        }

        {/* ─── CONTENIDO PRINCIPAL ─── */}
        <main className="hp-main">

          {/* Cabecera de la sección */}
          <div className="svc-header">
            <h1 className="svc-header__title">✂️ Servicios</h1>
          </div>

          {/* Área de contenido */}
          <div className="svc-content">

            {/* Fila: botón agregar + selector de sucursal */}
            {!loadingInit && selectedSucursal && (
              <div className="svc-top-bar">
                <button
                  className="btn svc-btn-add"
                  onClick={() => setCrearOpen(true)}
                  type="button"
                  disabled={loadingServicios}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5"  y1="12" x2="19" y2="12"/>
                  </svg>
                  Agregar servicio
                </button>

                {!isSucursalMode && sucursales.length > 1 && (
                  <CustomSelect
                    options={sucursales.map((s, idx) => ({ value: String(s.id), label: s.nombre?.trim() || `Sucursal ${idx + 1}` }))}
                    value={String(selectedSucursal?.id ?? '')}
                    onChange={(val) => {
                      const found = sucursales.find((s) => String(s.id) === val)
                      if (found) { setSelectedSucursal(found); setServicios([]) }
                    }}
                    width={285}
                    height={36}
                  />
                )}
              </div>
            )}

            {/* Carga inicial */}
            {loadingInit && (
              <div className="svc-loading">
                <div className="spinner" />
              </div>
            )}

            {/* Sin sucursal seleccionada */}
            {!loadingInit && !selectedSucursal && sucursales.length > 1 && (
              <div className="empty-state">
                <div className="empty-state-icon">✂️</div>
                <h3>Sin sucursal</h3>
                <p>Seleccioná una sucursal para ver sus servicios.</p>
              </div>
            )}

            {/* Sin empresa con sucursales */}
            {!loadingInit && sucursales.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">ℹ️</div>
                <h3>Sin sucursales</h3>
                <p>No hay sucursales disponibles para esta empresa.</p>
              </div>
            )}

            {/* Carga de servicios */}
            {!loadingInit && selectedSucursal && loadingServicios && (
              <div className="svc-loading">
                <div className="spinner" />
              </div>
            )}

            {/* Grid de servicios */}
            {!loadingInit && selectedSucursal && !loadingServicios && servicios.length > 0 && (
              <div className="svc-grid">
                {servicios.map((svc) => (
                  <ServicioCard
                    key={svc.id}
                    servicio={svc}
                    onClick={() => setSelectedServicio(svc)}
                  />
                ))}
              </div>
            )}

            {/* Sin servicios en la sucursal */}
            {!loadingInit && selectedSucursal && !loadingServicios && servicios.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">✂️</div>
                <h3>Sin servicios</h3>
                <p>Esta sucursal no posee servicios configurados.</p>
              </div>
            )}
          </div>

        </main>
      </div>

      {/* Modal de creación de servicio */}
      {crearOpen && selectedSucursal && (
        <ServicioModal
          sucursalId={selectedSucursal.id}
          miembros={miembros}
          onClose={() => setCrearOpen(false)}
          onSaved={handleServicioCreated}
        />
      )}

      {/* Modal de edición del servicio */}
      {selectedServicio && selectedSucursal && (
        <ServicioModal
          servicio={selectedServicio}
          sucursalId={selectedSucursal.id}
          miembros={miembros}
          onClose={() => setSelectedServicio(null)}
          onUpdated={handleServicioUpdated}
          onVersionUpdated={handleVersionUpdated}
          onDeleted={handleServicioDeleted}
        />
      )}

      {/* Modal de errores del back */}
      {backError && <ErrorModal error={backError} onClose={() => setBackError(null)} />}
    </div>
  )
}
