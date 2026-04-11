import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { sucursalService } from '../../services/sucursalService'
import { empresaService } from '../../services/empresaService'
import { useAuth } from '../../context/AuthContext'
import { formatDiaSemana, formatFechaTurno, formatHoraTurno, labelEstado } from '../../utils/dateUtils'
import AppTopBar from '../../components/AppTopBar/AppTopBar'
import UserTopBarRight from '../../components/UserTopBarRight/UserTopBarRight'
import EmpresaSidebar from '../../components/EmpresaSidebar/EmpresaSidebar'
import TurnoDetalleSucursalModal from '../../components/TurnoDetalleSucursalModal/TurnoDetalleSucursalModal'
import ErrorModal from '../../components/ErrorModal/ErrorModal'
import CustomSelect from '../../components/CustomSelect/CustomSelect'
import '../../components/TurnoCard/TurnoCard.css'
import './TurnosSucursal.css'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutos

// Calcula countdown igual que en TurnoCard de usuario
function calcularCountdown(diffMs) {
  if (diffMs <= 0) return null
  const diffMin   = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMs / 3600000)
  const diffDias  = Math.floor(diffMs / 86400000)
  const diffAnios = Math.floor(diffDias / 365)
  if (diffAnios >= 1)  return diffAnios === 1 ? 'falta 1 año' : `faltan ${diffAnios} años`
  if (diffDias >= 1)   return diffDias === 1 ? 'falta 1 día' : `faltan ${diffDias} días`
  if (diffHoras >= 1)  return `faltan ${diffHoras} hs`
  if (diffMin >= 2)    return `faltan ${diffMin} min`
  if (diffMin >= 1)    return 'falta 1 minuto'
  return 'falta menos de un minuto'
}

/**
 * Tarjeta de turno para el contexto de empresa/sucursal.
 * Igual que TurnoCard de usuario pero en vez del logo muestra el emoji 👤
 * con "Apellido, Nombre (DNI XXX)" como nombre principal y el servicio abajo.
 */
export function TurnoCardSucursal({ turno, onSelect }) {
  const dia   = formatDiaSemana(turno.fecha_hora)
  const fecha = formatFechaTurno(turno.fecha_hora)
  const hora  = formatHoraTurno(turno.fecha_hora)

  // Mismo ref para reducir font-size del datetime que TurnoCard de usuario
  const datetimeRef = useRef(null)

  const ahora       = Date.now()
  const inicioTurno = new Date(turno.fecha_hora).getTime()
  const finTurno    = inicioTurno + turno.duracion * 60 * 1000

  let estadoVisible = turno.estado_turno
  if (turno.estado_turno === 'CONFIRMADO') {
    if      (ahora >= finTurno)    estadoVisible = 'VENCIDO'
    else if (ahora >= inicioTurno) estadoVisible = 'EN_HORA'
  }

  const countdown = estadoVisible === 'CONFIRMADO'
    ? calcularCountdown(inicioTurno - ahora)
    : null

  // Reduce font-size del datetime hasta que entre (igual que TurnoCard)
  useEffect(() => {
    const el = datetimeRef.current
    if (!el) return
    el.style.fontSize = ''
    let fs = parseFloat(window.getComputedStyle(el).fontSize)
    while (el.scrollWidth > el.clientWidth && fs > 1) {
      fs -= 0.5
      el.style.fontSize = fs + 'px'
    }
  }, [dia, fecha, hora, countdown, estadoVisible])

  const estadoClass = {
    CONFIRMADO:            'tcard__badge--confirmado',
    EN_HORA:               'tcard__badge--en-hora',
    CANCELADO_POR_USUARIO: 'tcard__badge--cancelado',
    CANCELADO_POR_EMPRESA: 'tcard__badge--cancelado',
    CUMPLIDO:              'tcard__badge--cumplido',
    NO_CUMPLIDO:           'tcard__badge--no-cumplido',
    VENCIDO:               'tcard__badge--vencido',
  }[estadoVisible] || 'tcard__badge--confirmado'

  const clienteNombre = `${turno.cliente_apellido}, ${turno.cliente_nombre}`

  return (
    <article
      className="tcard"
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      aria-label={`Turno de ${clienteNombre}, ${dia} ${fecha} a las ${hora}`}
    >
      {/* Fila 1: día · fecha · hora */}
      <div className="tcard__top">
        <div className="tcard__datetime" ref={datetimeRef}>
          <span className="tcard__dia">{dia}</span>
          <span className="tcard__fecha-hora">
            {fecha} · {hora} hs
            {countdown && <span className="tcard__countdown"> ({countdown})</span>}
          </span>
        </div>
      </div>

      {/* Fila 2: nombre cliente + servicio + badge */}
      <div className="tcard__bottom">
        <div className="tcard__info">
          <span className="tcard__nombre">
            <span className="tcard__servicio-emoji">👤</span>
            <span>{clienteNombre}</span>
          </span>
          <span className="tcard__servicio">
            <span className="tcard__servicio-emoji">✂️</span>
            <span className="tcard__servicio-nombre">{turno.nombre_de_servicio}</span>
          </span>
        </div>
        <span className={`tcard__badge ${estadoClass}`}>
          {labelEstado(estadoVisible)}
        </span>
      </div>
    </article>
  )
}

/**
 * Página de turnos de una empresa (vista por sucursal).
 * Usa el empresaId de la URL, carga las sucursales del panel y
 * obtiene los turnos de la sucursal seleccionada (igual que Servicios).
 * Sin barra de búsqueda.
 */
export default function TurnosSucursal() {
  const { id: empresaId } = useParams()
  const { empresaPanel }  = useAuth()

  // Sucursales disponibles (cargadas del panel)
  const [sucursales,        setSucursales]        = useState([])
  const [selectedSucursal,  setSelectedSucursal]  = useState(null)
  const [loadingInit,       setLoadingInit]       = useState(true)

  // Turnos de la sucursal seleccionada
  const [turnos,            setTurnos]            = useState([])
  const [loadingTurnos,     setLoadingTurnos]     = useState(false)

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

  // Carga turnos cuando cambia la sucursal seleccionada
  useEffect(() => {
    if (!selectedSucursal) return
    const fetchTurnos = async () => {
      setLoadingTurnos(true)
      try {
        const data = await sucursalService.getTurnos(selectedSucursal.id)
        setTurnos(data ?? [])
      } catch (err) {
        setBackError(err)
      } finally {
        setLoadingTurnos(false)
      }
    }
    fetchTurnos()
  }, [selectedSucursal])

  // Polling de estados cada 5 min — actualiza el estado de cada turno sin recargar todo
  useEffect(() => {
    if (!selectedSucursal) return
    const poll = setInterval(async () => {
      try {
        const estados = await sucursalService.getEstadosTurnos(selectedSucursal.id)
        setTurnos((prev) =>
          prev.map((t) => {
            const nuevo = estados.find((e) => e.id === t.id)
            return nuevo ? { ...t, estado_turno: nuevo.estado } : t
          })
        )
      } catch { /* polling silencioso */ }
    }, POLL_INTERVAL)
    return () => clearInterval(poll)
  }, [selectedSucursal])

  const handleTurnoActualizado = (turnoActualizado) => {
    setTurnos((prev) =>
      prev.map((t) => t.id === turnoActualizado.id ? turnoActualizado : t)
    )
    setTurnoSeleccionado(turnoActualizado)
  }

  const handleTurnoEliminado = (turnoId) => {
    setTurnos((prev) => prev.filter((t) => t.id !== turnoId))
    setTurnoSeleccionado(null)
  }

  // Ordena: CONFIRMADO y EN_HORA primero, luego por fecha ascendente
  const turnosOrdenados = [...turnos].sort((a, b) => {
    const aConf = a.estado_turno === 'CONFIRMADO'
    const bConf = b.estado_turno === 'CONFIRMADO'
    if (aConf && !bConf) return -1
    if (!aConf && bConf) return 1
    return new Date(a.fecha_hora) - new Date(b.fecha_hora)
  })

  const loading = loadingInit || loadingTurnos

  return (
    <div className="tsuc-page">

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
          activeKey="turnos"
        />

        {/* ─── CONTENIDO ─── */}
        <main className="hp-main">

          {/* Título — misma clase y fuente que Historial */}
          <h1 className="reg-title">📅 Turnos</h1>

          {/* Contenido: selector + tarjetas, con 24px de distancia al título */}
          <div className="tsuc-content">

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
                    setTurnos([])
                  }}
                  width="100%"
                  height={37}
                />
              </div>
            )}

            {loading && (
              <div className="loading-inline"><div className="spinner" /></div>
            )}

            {!loading && !selectedSucursal && sucursales.length > 1 && (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <p>Seleccioná una sucursal para ver sus turnos.</p>
              </div>
            )}

            {!loading && selectedSucursal && turnosOrdenados.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <h3>Sin turnos</h3>
                <p>No hay turnos activos para esta sucursal.</p>
              </div>
            )}

            {!loading && selectedSucursal && turnosOrdenados.length > 0 && (
              <div className="hp-turnos-grid">
                {turnosOrdenados.map((turno) => (
                  <TurnoCardSucursal
                    key={turno.id}
                    turno={turno}
                    onSelect={() => setTurnoSeleccionado(turno)}
                  />
                ))}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ─── Modales ─── */}
      <TurnoDetalleSucursalModal
        turno={turnoSeleccionado}
        sucursalId={selectedSucursal?.id}
        onClose={() => setTurnoSeleccionado(null)}
        onUpdated={handleTurnoActualizado}
        onDeleted={handleTurnoEliminado}
        onError={setBackError}
      />
      <ErrorModal error={backError} onClose={() => setBackError(null)} />

    </div>
  )
}
