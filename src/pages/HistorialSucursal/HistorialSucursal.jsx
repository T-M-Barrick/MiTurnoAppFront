import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { sucursalService } from '../../services/sucursalService'
import { empresaService } from '../../services/empresaService'
import { useAuth } from '../../context/AuthContext'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import { TurnoCardSucursal } from '../TurnosSucursal/TurnosSucursal'
import TurnoDetalleSucursalModal from '../../components/TurnoDetalleSucursalModal/TurnoDetalleSucursalModal'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import '../../components/TurnoCard/TurnoCard.css'
import './HistorialSucursal.css'

/**
 * Página de historial de turnos para empresa/sucursal.
 * Misma estructura que TurnosSucursal pero con paginación por cursor
 * y detalle en modo solo lectura (solo botón Cerrar).
 */
export default function HistorialSucursal() {
  const { id: empresaId } = useParams()
  const { empresaPanel, setEmpresaPanel } = useAuth()

  // Sucursales disponibles
  const [sucursales,       setSucursales]       = useState([])
  const [selectedSucursal, setSelectedSucursal] = useState(null)
  const [loadingInit,      setLoadingInit]      = useState(true)

  // Historial paginado
  const [historial,    setHistorial]    = useState([])
  const [loadingHist,  setLoadingHist]  = useState(false)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [cursor,       setCursor]       = useState(null) // { fecha_hora, id } | null
  const [hayMas,       setHayMas]       = useState(false)

  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null)
  const [sidebarOpen,       setSidebarOpen]       = useState(false)
  const [backError,         setBackError]         = useState(null)

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
  }, [empresaId])

  // Carga historial cuando cambia la sucursal
  useEffect(() => {
    if (!selectedSucursal) return
    const fetchHistorial = async () => {
      setLoadingHist(true)
      setHistorial([])
      setCursor(null)
      setHayMas(false)
      try {
        const data = await sucursalService.getHistorial(selectedSucursal.id)
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
        setLoadingHist(false)
      }
    }
    fetchHistorial()
  }, [selectedSucursal])

  // Carga más entradas usando el cursor
  const handleCargarMas = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await sucursalService.getHistorial(selectedSucursal.id, {
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

  const loading = loadingInit || loadingHist

  return (
    <div className="hsuc-page">

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
        right={<UserTopBarRight empresaId={empresaId} />}
      />

      {/* ═══ CUERPO ═══ */}
      <div className="hp-body">

        <EmpresaSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          empresaId={empresaId}
          activeKey="historial"
        />

        {/* ─── CONTENIDO ─── */}
        <main className="hp-main">

          <h1 className="reg-title">📋 Historial</h1>

          <div className="hsuc-content">

            {/* Selector de sucursal (solo si hay más de una) */}
            {!loadingInit && sucursales.length > 1 && (
              <div className="svc-sucursal-wrap">
                <CustomSelect
                  options={sucursales.map((s, idx) => ({ value: String(s.id), label: s.nombre?.trim() || `Sucursal ${idx + 1}` }))}
                  value={String(selectedSucursal?.id ?? '')}
                  onChange={(val) => {
                    const found = sucursales.find((s) => String(s.id) === val)
                    if (found) setSelectedSucursal(found)
                  }}
                  width={285}
                  height={36}
                />
              </div>
            )}

            {/* Carga */}
            {loading && (
              <div className="hist-loading"><div className="spinner" /></div>
            )}

            {/* Sin sucursal seleccionada */}
            {!loading && !selectedSucursal && sucursales.length > 1 && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>Sin sucursal</h3>
                <p>Seleccioná una sucursal para ver su historial.</p>
              </div>
            )}

            {/* Sin turnos en historial */}
            {!loading && selectedSucursal && historial.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <h3>Sin turnos</h3>
                <p>No hay turnos en el historial de esta sucursal.</p>
              </div>
            )}

            {/* Lista de turnos */}
            {!loading && selectedSucursal && historial.length > 0 && (
              <div className="hist-list">
                {historial.map((turno) => (
                  <TurnoCardSucursal
                    key={turno.id}
                    turno={turno}
                    onSelect={() => setTurnoSeleccionado(turno)}
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
                    {loadingMore ? <span className="spinner spinner-sm" /> : 'Cargar más'}
                  </button>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modal de detalle — solo lectura */}
      <TurnoDetalleSucursalModal
        turno={turnoSeleccionado}
        sucursalId={selectedSucursal?.id}
        onClose={() => setTurnoSeleccionado(null)}
        onError={setBackError}
        readOnly={true}
      />

      <ErrorModal error={backError} onClose={() => setBackError(null)} />
    </div>
  )
}
