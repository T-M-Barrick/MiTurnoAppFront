import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifTitle, getNotifBody, getNotifIcon, formatNotifTime } from '../../utils/notifUtils'
import { empresaService } from '../../services/empresaService'
import { sucursalService } from '../../services/sucursalService'
import { usuarioService } from '../../services/usuarioService'
import './NotificationBell.css'

const MAX_PREVIEW = 5

/**
 * Campana de notificaciones con dropdown desplegable.
 * Muestra hasta 5 notificaciones recientes.
 * El polling está centralizado en AuthContext — este componente solo muestra datos.
 *
 * Props:
 *   notificaciones   — array de NotificacionOut (viene de AuthContext via UserTopBarRight)
 *   ultimoCursorId   — int | null (cursor para paginación hacia atrás)
 *   notifContext     — { type: 'usuario' | 'empresa' | 'sucursal', id?: string }
 *   onNotifLeida     — callback(notifId) para sincronizar con AuthContext
 */
export default function NotificationBell({
  notificaciones: notifProp = [],
  ultimoCursorId: cursorProp = null,
  notifContext = { type: 'usuario' },
  onNotifLeida,  // callback(notifId) — actualiza la fuente de verdad en AuthContext
  sucursales,    // array {id, nombre} del panel — para lookup de nombre por sucursal_id
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notificaciones, setNotificaciones] = useState(notifProp)
  const [ultimoCursorId, setUltimoCursorId] = useState(cursorProp)
  const dropRef   = useRef(null)
  // Ref para el ID más alto que tenemos — usado por el polling sin re-crear el intervalo
  const latestIdRef = useRef(notifProp[0]?.id ?? null)

  // Sincroniza cuando cambian los datos del home (recarga, navegación)
  useEffect(() => {
    setNotificaciones(notifProp)
    setUltimoCursorId(cursorProp)
    if (notifProp.length > 0) latestIdRef.current = notifProp[0].id
  }, [notifProp, cursorProp])

  // Mantiene latestIdRef actualizado cuando nuevas notificaciones llegan
  useEffect(() => {
    if (notificaciones.length > 0) {
      latestIdRef.current = notificaciones[0].id
    }
  }, [notificaciones])

  // El polling de empresa y usuario está centralizado en AuthContext.
  // NotificationBell solo muestra los datos — no hace polling propio.

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notificaciones.filter((n) => !n.leida).length
  const preview     = notificaciones.slice(0, MAX_PREVIEW)

  // Marca una notificación como leída en el back y actualiza el estado local.
  // Tras el API call exitoso notifica al padre (onNotifLeida) para que actualice
  // la fuente de verdad (AuthContext o empresaData), evitando que re-renders
  // del padre reviertan el cambio.
  const handleMarkLeida = async (notif) => {
    if (notif.leida) return
    // Actualización optimista local
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, leida: true } : n))
    )
    try {
      const { type, id } = notifContext
      if (type === 'usuario')       await usuarioService.markNotificacionLeida(notif.id)
      else if (type === 'empresa')  await empresaService.markNotificacionLeida(id, notif.id)
      else if (type === 'sucursal') await sucursalService.markNotificacionLeida(id, notif.id)
      // Actualiza la fuente de verdad para que el estado persista ante re-renders
      onNotifLeida?.(notif.id)
    } catch {
      // Revierte si falla
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, leida: false } : n))
      )
    }
  }

  // Devuelve { route, state } para navegar al hacer click en una notificación.
  // Si el turno o miembro ya no existe en el destino, la página simplemente no abre nada.
  const getNotifDest = (notif) => {
    const turnoId   = notif.extra_data?.turno_id
    const usuarioId = notif.extra_data?.usuario_id
    const tipo      = notif.tipo
    const { type, id } = notifContext

    // Notificaciones de turno
    if (turnoId) {
      if (type === 'usuario') return { route: '/home',                    state: { openTurnoId: turnoId } }
      if (type === 'empresa') return { route: `/empresa/${id}/turnos`,    state: { openTurnoId: turnoId } }
      if (type === 'sucursal') return { route: `/sucursal/${id}`,         state: { openTurnoId: turnoId } }
    }

    // Notificaciones de miembro
    if (usuarioId && (tipo === 'MIEMBRO_NUEVO_EMPRESA' || tipo === 'MIEMBRO_NUEVO_SUCURSAL')) {
      if (type === 'empresa') return { route: `/empresa/${id}/miembros`, state: { openUsuarioId: usuarioId } }
    }

    return null
  }

  // Ruta de "Ver todas"
  const verTodasRoute = notifContext.type === 'usuario'
    ? '/notificaciones'
    : `/empresa/${notifContext.id}/notificaciones`

  // Al hacer click izquierdo en una notificación: marcar como leída y navegar
  const handleNotifClick = async (e, notif) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setOpen(false)
    await handleMarkLeida(notif)
    const dest = getNotifDest(notif)
    if (dest) navigate(dest.route, { state: dest.state })
  }

  // Al hacer click izquierdo en "Ver todas"
  const handleVerTodas = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setOpen(false)
    navigate(verTodasRoute, {
      state: { notificaciones, ultimoCursorId, notifContext },
    })
  }

  return (
    <div className="nbell" ref={dropRef}>
      {/* ── Botón campana ── */}
      <button
        className="app-topbar__icon-btn nbell__btn"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="nbell__icon"
          width="20" height="20"
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="nbell__badge" aria-label={`${unreadCount} sin leer`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="nbell__dropdown" role="dialog" aria-label="Notificaciones">

          {/* Cabecera */}
          <div className="nbell__head">
            <span className="nbell__head-title">Notificaciones</span>
            {unreadCount > 0 && (
              <span className="nbell__head-count">{unreadCount} sin leer</span>
            )}
          </div>

          {/* Lista o estado vacío */}
          {notificaciones.length === 0 ? (
            <div className="nbell__empty">
              <span className="nbell__empty-icon">🔔</span>
              <p>No tenés notificaciones</p>
            </div>
          ) : (
            <>
              <ul className="nbell__list" role="list">
                {preview.map((notif) => {
                  const notifDest = getNotifDest(notif)
                  return (
                    <li
                      key={notif.id}
                      className={`nbell__item${notif.leida ? ' nbell__item--read' : ''}`}
                    >
                      <a
                        href={notifDest ? `#${notifDest.route}` : undefined}
                        className="nbell__item-btn"
                        onClick={(e) => handleNotifClick(e, notif)}
                      >
                        {/* Punto de no leída */}
                        <span className="nbell__item-dot-wrap">
                          {!notif.leida && <span className="nbell__item-dot" />}
                        </span>

                        {/* Contenido */}
                        <span className="nbell__item-content">
                          <span className="nbell__item-head">
                            <span className="nbell__item-icon" aria-hidden="true">
                              {getNotifIcon(notif.tipo)}
                            </span>
                            <span className="nbell__item-title">
                              {getNotifTitle(notif.tipo)}
                            </span>
                            <span className="nbell__item-time">
                              {formatNotifTime(notif.created_at)}
                            </span>
                          </span>
                          <p className="nbell__item-body">
                            {getNotifBody(notif.tipo, notif.extra_data, sucursales)}
                          </p>
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>

              {/* "Ver todas" */}
              <a
                href={`#${verTodasRoute}`}
                className="nbell__ver-todas"
                onClick={handleVerTodas}
              >
                Ver todas las notificaciones
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}
